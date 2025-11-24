import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { redisClient } from '../lib/redis';
import { nanoid } from 'nanoid';
import { logger } from '../utils/logger';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Transaction schema for validation
 */
const TransactionSchema = z.object({
  customerId: z.string(),
  cardId: z.string(),
  mcc: z.string(),
  merchant: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  ts: z.string().datetime().or(z.date()),
  deviceId: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
});

/**
 * POST /api/ingest/transactions
 * Ingest transactions from CSV or JSON with deduplication
 */
router.post(
  '/transactions',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // Check idempotency
    if (idempotencyKey) {
      const cached = await redisClient.get(`idempotency:${idempotencyKey}`);
      if (cached) {
        logger.info('Returning cached response for idempotency key', { idempotencyKey });
        return res.json(JSON.parse(cached));
      }
    }

    const requestId = nanoid();
    let transactions: any[] = [];

    // Parse file upload
    if (req.file) {
      const content = req.file.buffer.toString('utf-8');
      const filename = req.file.originalname || '';
      
      // Detect file type by extension or content
      if (filename.endsWith('.json') || content.trim().startsWith('{') || content.trim().startsWith('[')) {
        // Parse as JSON
        try {
          const parsed = JSON.parse(content);
          transactions = parsed.transactions || (Array.isArray(parsed) ? parsed : []);
        } catch (error) {
          throw new ApiError('Invalid JSON file format', 400);
        }
      } else {
        // Parse as CSV
        transactions = parse(content, {
          columns: true,
          skip_empty_lines: true,
          cast: (value, context) => {
            if (context.column === 'amountCents') return parseInt(value, 10);
            return value;
          },
        });
      }
    }
    // Parse JSON body
    else if (req.body.transactions) {
      transactions = req.body.transactions;
    } else {
      throw new ApiError('Missing transactions data', 400);
    }

    // Validate transactions
    const validatedTransactions = transactions.map((txn, idx) => {
      try {
        return TransactionSchema.parse(txn);
      } catch (error) {
        throw new ApiError(`Invalid transaction at index ${idx}: ${error}`, 400);
      }
    });

    // Upsert transactions with deduplication
    const upsertPromises = validatedTransactions.map((txn) =>
      prisma.transaction.upsert({
        where: {
          customerId_id: {
            customerId: txn.customerId,
            id: `${txn.customerId}-${txn.merchant}-${txn.amountCents}-${new Date(txn.ts).getTime()}`,
          },
        },
        update: {},
        create: {
          id: `${txn.customerId}-${txn.merchant}-${txn.amountCents}-${new Date(txn.ts).getTime()}`,
          customerId: txn.customerId,
          cardId: txn.cardId,
          mcc: txn.mcc,
          merchant: txn.merchant,
          amountCents: txn.amountCents,
          currency: txn.currency,
          ts: new Date(txn.ts),
          deviceId: txn.deviceId,
          country: txn.country,
          city: txn.city,
        },
      })
    );

    await Promise.all(upsertPromises);

    const response = {
      accepted: true,
      count: validatedTransactions.length,
      requestId,
    };

    // Cache for idempotency
    if (idempotencyKey) {
      await redisClient.setEx(`idempotency:${idempotencyKey}`, 3600, JSON.stringify(response));
    }

    logger.logEvent({
      event: 'transactions_ingested',
      requestId,
      count: validatedTransactions.length,
    });

    return res.json(response);
  })
);

export const ingestRouter = router;
