import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Query parameters schema for transaction listing
 */
const TransactionQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

/**
 * GET /api/customer/:id/transactions
 * Get customer transactions with keyset pagination
 * Optimized for p95 <= 100ms on 1M+ rows
 */
router.get(
  '/:id/transactions',
  asyncHandler(async (req, res) => {
    const customerId = req.params.id;
    const query = TransactionQuerySchema.parse(req.query);

    const startTime = Date.now();

    // Parse cursor (format: timestamp_id)
    let cursorTs: Date | undefined;
    let cursorId: string | undefined;
    
    if (query.cursor) {
      const [ts, id] = query.cursor.split('_');
      cursorTs = new Date(parseInt(ts, 10));
      cursorId = id;
    }

    // Build where clause with proper indexing
    const where: any = {
      customerId,
    };

    // Date range filter
    if (query.from || query.to) {
      where.ts = {};
      if (query.from) where.ts.gte = new Date(query.from);
      if (query.to) where.ts.lte = new Date(query.to);
    }

    // Cursor-based pagination for keyset
    if (cursorTs && cursorId) {
      where.OR = [
        { ts: { lt: cursorTs } },
        {
          AND: [
            { ts: cursorTs },
            { id: { lt: cursorId } },
          ],
        },
      ];
    }

    // Query with keyset pagination (uses index on customerId, ts DESC)
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [
        { ts: 'desc' },
        { id: 'desc' },
      ],
      take: query.limit + 1, // Fetch one extra to check if there's a next page
    });

    // Check if there's a next page
    const hasNextPage = transactions.length > query.limit;
    const items = hasNextPage ? transactions.slice(0, query.limit) : transactions;

    // Generate next cursor
    let nextCursor: string | undefined;
    if (hasNextPage) {
      const lastItem = items[items.length - 1];
      nextCursor = `${lastItem.ts.getTime()}_${lastItem.id}`;
    }

    const duration = Date.now() - startTime;

    logger.info('Customer transactions fetched', {
      customerId,
      count: items.length,
      duration,
      hasNextPage,
    });

    return res.json({
      items,
      nextCursor,
      meta: {
        duration,
        count: items.length,
      },
    });
  })
);

/**
 * GET /api/customer/:id
 * Get customer details
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customerId = req.params.id;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        cards: true,
        accounts: true,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    return res.json(customer);
  })
);

export const customerRouter = router;
