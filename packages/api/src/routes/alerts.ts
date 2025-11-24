import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/alerts
 * Get all alerts
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const alerts = await prisma.alert.findMany({
      include: {
        customer: true,
        transaction: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return res.json(alerts);
  })
);

/**
 * GET /api/alerts/:id
 * Get single alert
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const alert = await prisma.alert.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            cards: true,
            accounts: true,
          },
        },
        transaction: true,
      },
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    return res.json(alert);
  })
);

export const alertsRouter = router;
