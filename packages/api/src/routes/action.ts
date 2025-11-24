import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { redisClient } from '../lib/redis';
import { nanoid } from 'nanoid';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { SchemaValidator } from '../agents/validation/SchemaValidator';
import { PromptInjectionGuard } from '../agents/validation/PromptInjectionGuard';
import { orchestrator } from '../agents/orchestratorInstance';

const router = Router();

/**
 * Action schemas
 */
const FreezeCardSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits').optional(),
  alertId: z.string().min(1).optional(), // Optional: to update alert status
});

const ContactCustomerSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000, 'Message too long'),
  alertId: z.string().min(1).optional(), // Optional: to update alert status
});

const MarkFalsePositiveSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
});

/**
 * POST /api/action/freeze-card
 * Freeze a card with optional OTP verification
 */
router.post(
  '/freeze-card',
  requireAuth,
  asyncHandler(async (req, res) => {
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // Check idempotency
    if (idempotencyKey) {
      const cached = await redisClient.get(`idempotency:${idempotencyKey}`);
      if (cached) {
        logger.info('Returning cached freeze-card response', { idempotencyKey });
        return res.json(JSON.parse(cached));
      }
    }

    // Validate input schema
    const data = SchemaValidator.validateInput(
      'freeze-card',
      req.body,
      FreezeCardSchema
    );
    const requestId = nanoid();

    // Get card
    const card = await prisma.card.findUnique({
      where: { id: data.cardId },
      include: { customer: true },
    });

    if (!card) {
      throw new ApiError('Card not found', 404);
    }

    // Check if OTP is required
    const requiresOTP = card.customer.kycLevel !== 'full';

    if (requiresOTP && !data.otp) {
      metrics.actionBlockedTotal.inc({ policy: 'otp_required' });
      
      const response = {
        status: 'PENDING_OTP',
        requestId,
        message: 'OTP verification required. Use OTP: 123456 for testing.',
      };

      // Cache response
      if (idempotencyKey) {
        await redisClient.setEx(`idempotency:${idempotencyKey}`, 3600, JSON.stringify(response));
      }

      return res.json(response);
    }

    // Verify OTP (hardcoded for testing)
    if (requiresOTP) {
      if (!data.otp) {
        throw new ApiError('OTP is required for this customer', 400);
      }
      if (data.otp !== '123456') {
        throw new ApiError('Invalid OTP. Use 123456 for testing.', 400);
      }
    }

    // Additional validation: Check if card is already frozen
    if (card.status === 'frozen') {
      throw new ApiError('Card is already frozen', 400);
    }

    // Freeze card
    await prisma.card.update({
      where: { id: data.cardId },
      data: { status: 'frozen' },
    });

    // Create case event
    await prisma.case.create({
      data: {
        customerId: card.customerId,
        type: 'freeze_card',
        status: 'COMPLETED',
        reasonCode: 'fraud_prevention',
        events: {
          create: {
            ts: new Date(),
            actor: req.user?.apiKey || 'system',
            action: 'freeze_card',
            payloadJson: { cardId: data.cardId, requestId },
          },
        },
      },
    });

    const response = {
      status: 'FROZEN',
      requestId,
      cardId: data.cardId,
    };

    // Cache response
    if (idempotencyKey) {
      await redisClient.setEx(`idempotency:${idempotencyKey}`, 3600, JSON.stringify(response));
    }

    // Update alert status if alertId is provided
    if (data.alertId) {
      await orchestrator.updateAlertStatusAfterAction(data.alertId, 'freeze_card');
    } else {
      // Try to find alert by card
      const alert = await prisma.alert.findFirst({
        where: {
          transaction: { cardId: data.cardId },
          status: 'open',
        },
        orderBy: { createdAt: 'desc' },
      });
      if (alert) {
        await orchestrator.updateAlertStatusAfterAction(alert.id, 'freeze_card');
      }
    }

    logger.logEvent({
      event: 'action_completed',
      action: 'freeze_card',
      requestId,
      cardId: data.cardId,
    });

    return res.json(response);
  })
);

/**
 * Open dispute schema
 */
const OpenDisputeSchema = z.object({
  txnId: z.string().min(1, 'Transaction ID is required'),
  reasonCode: z.string().min(1, 'Reason code is required').max(100, 'Reason code too long'),
  confirm: z.boolean().refine(val => val === true, 'Confirmation is required'),
  alertId: z.string().min(1).optional(), // Optional: to update alert status
});

/**
 * POST /api/action/open-dispute
 * Open a dispute for a transaction
 */
router.post(
  '/open-dispute',
  requireAuth,
  asyncHandler(async (req, res) => {
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // Check idempotency
    if (idempotencyKey) {
      const cached = await redisClient.get(`idempotency:${idempotencyKey}`);
      if (cached) {
        logger.info('Returning cached open-dispute response', { idempotencyKey });
        return res.json(JSON.parse(cached));
      }
    }

    // Validate input schema
    const data = SchemaValidator.validateInput(
      'open-dispute',
      req.body,
      OpenDisputeSchema
    );

    if (!data.confirm) {
      throw new ApiError('Confirmation required', 400);
    }

    // Validate reason code format
    // Support both generic codes and industry-standard Visa/Mastercard chargeback codes
    const genericCodes = ['fraud', 'unauthorized', 'duplicate', 'amount_incorrect', 'service_not_received', 'other'];
    const visaCodes = ['10.1', '10.2', '10.3', '10.4', '10.5', '11.1', '11.2', '11.3', '12.1', '12.2', '12.3', '12.4', '12.5', '12.6', '12.7', '13.1', '13.2', '13.3', '13.4', '13.5', '13.6', '13.7', '13.8', '13.9'];
    const mastercardCodes = ['4837', '4840', '4841', '4842', '4846', '4849', '4850', '4853', '4854', '4855', '4857', '4859', '4860', '4862', '4863', '4870', '4871'];
    
    const allValidCodes = [...genericCodes, ...visaCodes, ...mastercardCodes];
    
    if (!allValidCodes.includes(data.reasonCode) && !genericCodes.includes(data.reasonCode.toLowerCase())) {
      throw new ApiError(
        `Invalid reason code. Must be one of:\n` +
        `Generic: ${genericCodes.join(', ')}\n` +
        `Visa: ${visaCodes.slice(0, 8).join(', ')}...\n` +
        `Mastercard: ${mastercardCodes.slice(0, 8).join(', ')}...`,
        400
      );
    }

    // Get transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: data.txnId },
    });

    if (!transaction) {
      throw new ApiError('Transaction not found', 404);
    }

    // Check if dispute already exists
    const existingDispute = await prisma.case.findFirst({
      where: {
        txnId: data.txnId,
        type: 'dispute',
        status: { in: ['OPEN', 'PENDING'] },
      },
    });

    if (existingDispute) {
      throw new ApiError('A dispute already exists for this transaction', 409);
    }

    // Create case
    const disputeCase = await prisma.case.create({
      data: {
        customerId: transaction.customerId,
        txnId: data.txnId,
        type: 'dispute',
        status: 'OPEN',
        reasonCode: data.reasonCode,
        events: {
          create: {
            ts: new Date(),
            actor: req.user?.apiKey || 'system',
            action: 'open_dispute',
            payloadJson: {
              txnId: data.txnId,
              reasonCode: data.reasonCode,
              amountCents: transaction.amountCents,
            },
          },
        },
      },
    });

    const response = {
      caseId: disputeCase.id,
      status: 'OPEN',
      txnId: data.txnId,
    };

    // Cache response
    if (idempotencyKey) {
      await redisClient.setEx(`idempotency:${idempotencyKey}`, 3600, JSON.stringify(response));
    }

    // Update alert status if alertId is provided
    if (data.alertId) {
      await orchestrator.updateAlertStatusAfterAction(data.alertId, 'open_dispute');
    } else {
      // Try to find alert by transaction
      const alert = await prisma.alert.findFirst({
        where: {
          suspectTxnId: data.txnId,
          status: 'open',
        },
        orderBy: { createdAt: 'desc' },
      });
      if (alert) {
        await orchestrator.updateAlertStatusAfterAction(alert.id, 'open_dispute');
      }
    }

    logger.logEvent({
      event: 'action_completed',
      action: 'open_dispute',
      caseId: disputeCase.id,
      txnId: data.txnId,
    });

    return res.json(response);
  })
);

/**
 * POST /api/action/contact-customer
 * Create a case for customer contact
 */
router.post(
  '/contact-customer',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Validate schema
    const data = SchemaValidator.validateInput(
      'contact-customer',
      req.body,
      ContactCustomerSchema
    );

    const { customerId, message } = data;

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new ApiError('Customer not found', 404);
    }

    // Validate message is not just whitespace
    if (message.trim().length < 10) {
      throw new ApiError('Message must contain at least 10 meaningful characters', 400);
    }

    // Validate against prompt injection
    const isValid = await PromptInjectionGuard.validateAgainstPolicy(message, {
      userId: req.user?.apiKey,
      action: 'contact_customer',
    });

    if (!isValid) {
      throw new ApiError('Input contains potentially malicious content', 400);
    }

    // Sanitize user input
    const sanitizedMessage = PromptInjectionGuard.sanitize(message);

    // Create case
    const contactCase = await prisma.case.create({
      data: {
        customerId,
        type: 'contact_required',
        status: 'PENDING',
        reasonCode: 'verification_needed',
        events: {
          create: {
            ts: new Date(),
            actor: req.user?.apiKey || 'system',
            action: 'contact_customer',
            payloadJson: { customerId, message: sanitizedMessage },
          },
        },
      },
    });

    // Update alert status if alertId is provided
    if (data.alertId) {
      await orchestrator.updateAlertStatusAfterAction(data.alertId, 'contact_customer');
    } else {
      // Try to find alert by customer
      const alert = await prisma.alert.findFirst({
        where: {
          customerId,
          status: 'open',
        },
        orderBy: { createdAt: 'desc' },
      });
      if (alert) {
        await orchestrator.updateAlertStatusAfterAction(alert.id, 'contact_customer');
      }
    }

    logger.logEvent({
      event: 'action_completed',
      action: 'contact_customer',
      caseId: contactCase.id,
      customerId,
    });

    return res.json({
      caseId: contactCase.id,
      status: 'PENDING',
    });
  })
);

/**
 * POST /api/action/mark-false-positive
 * Mark alert as false positive
 */
router.post(
  '/mark-false-positive',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Validate schema
    const data = SchemaValidator.validateInput(
      'mark-false-positive',
      req.body,
      MarkFalsePositiveSchema
    );

    const { alertId } = data;

    await prisma.alert.update({
      where: { id: alertId },
      data: { status: 'false_positive' },
    });

    logger.logEvent({
      event: 'action_completed',
      action: 'mark_false_positive',
      alertId,
    });

    return res.json({ success: true });
  })
);

export const actionRouter = router;
