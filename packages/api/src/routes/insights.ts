import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/insights/:customerId/summary
 * Get customer insights: categories, merchants, anomalies, monthly trends
 */
router.get(
  '/:customerId/summary',
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const startTime = Date.now();

    // Get transactions from last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const transactions = await prisma.transaction.findMany({
      where: {
        customerId,
        ts: { gte: ninetyDaysAgo },
      },
      orderBy: { ts: 'desc' },
    });

    // Calculate top merchants
    const merchantMap = new Map<string, number>();
    transactions.forEach((txn) => {
      merchantMap.set(txn.merchant, (merchantMap.get(txn.merchant) || 0) + 1);
    });

    const topMerchants = Array.from(merchantMap.entries())
      .map(([merchant, count]) => ({ merchant, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate categories based on MCC
    const categoryMap = new Map<string, { count: number; amount: number }>();
    const mccToCategory = getMCCCategory;

    transactions.forEach((txn) => {
      const category = mccToCategory(txn.mcc);
      const current = categoryMap.get(category) || { count: 0, amount: 0 };
      categoryMap.set(category, {
        count: current.count + 1,
        amount: current.amount + txn.amountCents,
      });
    });

    const totalAmount = transactions.reduce((sum, txn) => sum + txn.amountCents, 0);
    const categories = Array.from(categoryMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        pct: totalAmount > 0 ? data.amount / totalAmount : 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    // Calculate monthly trends
    const monthlyMap = new Map<string, number>();
    transactions.forEach((txn) => {
      const month = txn.ts.toISOString().slice(0, 7); // YYYY-MM
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + txn.amountCents);
    });

    const monthlyTrend = Array.from(monthlyMap.entries())
      .map(([month, sum]) => ({ month, sum }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Detect anomalies (simple z-score based)
    const amounts = transactions.map((t) => t.amountCents);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    const anomalies = transactions
      .filter((txn) => {
        const zScore = Math.abs((txn.amountCents - mean) / stdDev);
        return zScore > 2.5; // Flag transactions with z-score > 2.5
      })
      .map((txn) => ({
        ts: txn.ts.toISOString(),
        merchant: txn.merchant,
        amountCents: txn.amountCents,
        z: ((txn.amountCents - mean) / stdDev).toFixed(2),
        note: 'Amount spike',
      }))
      .slice(0, 5);

    const duration = Date.now() - startTime;

    logger.info('Insights generated', {
      customerId,
      duration,
      transactionCount: transactions.length,
    });

    return res.json({
      topMerchants,
      categories,
      monthlyTrend,
      anomalies,
      meta: {
        duration,
        transactionCount: transactions.length,
        period: '90 days',
      },
    });
  })
);

/**
 * Map MCC code to category
 * Simplified mapping for common MCCs
 */
function getMCCCategory(mcc: string): string {
  const mccNum = parseInt(mcc, 10);

  if (mccNum >= 4000 && mccNum < 5000) return 'Transport';
  if (mccNum >= 5000 && mccNum < 6000) return 'Retail';
  if (mccNum >= 5400 && mccNum < 5500) return 'Food & Dining';
  if (mccNum >= 7000 && mccNum < 8000) return 'Services';
  if (mccNum >= 8000 && mccNum < 9000) return 'Healthcare';
  if (mccNum >= 4800 && mccNum < 4900) return 'Utilities';

  return 'Other';
}

export const insightsRouter = router;
