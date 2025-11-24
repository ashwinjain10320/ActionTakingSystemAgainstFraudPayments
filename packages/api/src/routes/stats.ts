import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export const statsRouter = Router();

/**
 * GET /api/stats
 * Returns dashboard statistics
 */
statsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // Get all triage runs with their completion status
    const triageRuns = await prisma.triageRun.findMany({
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        risk: true,
        latencyMs: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 1000, // Last 1000 runs for stats
    });

    // Calculate average triage latency
    const completedRuns = triageRuns.filter(run => run.endedAt && run.latencyMs);
    const totalLatency = completedRuns.reduce((sum, run) => {
      return sum + (run.latencyMs || 0);
    }, 0);
    const avgLatencyMs = completedRuns.length > 0 
      ? Math.round(totalLatency / completedRuns.length) 
      : 0;
    const avgTriageLatency = avgLatencyMs >= 1000 
      ? `${(avgLatencyMs / 1000).toFixed(1)}s`
      : `${avgLatencyMs}ms`;

    // Count alerts by status
    const resolvedAlerts = await prisma.alert.count({
      where: {
        status: 'resolved',
      },
    });

    const closedAlerts = await prisma.alert.count({
      where: {
        status: 'closed',
      },
    });

    const frozenAlerts = await prisma.alert.count({
      where: {
        status: 'frozen',
      },
    });

    // Count actual dispute cases
    const disputeCases = await prisma.case.count({
      where: {
        type: 'dispute',
      },
    });

    // Count contact cases
    const contactCases = await prisma.case.count({
      where: {
        type: 'contact_required',
      },
    });

    // Use actual counts from database
    const disputesOpened = disputeCases; // Actual dispute count from cases
    const cardsFrozen = frozenAlerts; // Actual frozen count from alert status
    const falsePositivesMarked = closedAlerts; // From closed alert status
    const customersContacted = contactCases; // Actual contact cases
    
    // Total actions = sum of all case types + alert status changes
    const totalActions = disputeCases + contactCases + frozenAlerts + closedAlerts + resolvedAlerts;

    // Get triage success rate (completed vs failed)
    const totalTriages = triageRuns.length;
    const successfulTriages = completedRuns.length;
    const successRate = totalTriages > 0 
      ? Math.round((successfulTriages / totalTriages) * 100) 
      : 0;

    // Get evaluation stats from triage runs
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const recentEvals = await prisma.triageRun.findMany({
      where: {
        startedAt: {
          gte: last30Days,
        },
        endedAt: {
          not: null,
        },
      },
      select: {
        risk: true,
        latencyMs: true,
      },
    });

    const evalResults = recentEvals.map(run => {
      return {
        passed: run.risk !== null,
        latency: run.latencyMs || 0,
      };
    });

    const evalsPassed = evalResults.filter(r => r.passed).length;
    const evalsTotal = evalResults.length;
    const evalsPassRate = evalsTotal > 0 
      ? Math.round((evalsPassed / evalsTotal) * 100) 
      : 0;
    
    const avgEvalLatency = evalResults.length > 0
      ? Math.round(evalResults.reduce((sum, r) => sum + r.latency, 0) / evalResults.length)
      : 0;

    res.json({
      disputes: {
        opened: disputesOpened,
        total: totalActions,
      },
      triage: {
        avgLatency: avgTriageLatency,
        avgLatencyMs,
        total: totalTriages,
        completed: successfulTriages,
        successRate,
      },
      actions: {
        total: totalActions,
        cardsFrozen,
        disputesOpened,
        customersContacted,
        falsePositivesMarked,
      },
      evals: {
        total: evalsTotal,
        passed: evalsPassed,
        passRate: evalsPassRate,
        avgLatencyMs: avgEvalLatency,
      },
    });
  } catch (error: any) {
    logger.error('Failed to fetch stats', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: error.message,
    });
  }
});

/**
 * GET /api/stats/evals
 * Returns detailed evaluation results
 */
statsRouter.get('/evals', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Get recent triage runs as eval results
    const triageRuns = await prisma.triageRun.findMany({
      where: {
        endedAt: {
          not: null,
        },
      },
      include: {
        alert: {
          select: {
            id: true,
            customerId: true,
            risk: true,
            suspectTxnId: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: limit,
    });

    const evalResults = triageRuns.map((run) => {
      const latencyMs = run.latencyMs || 0;
      
      const expected = getExpectedAction(run.alert?.risk || 'medium');
      const actual = getExpectedAction(run.risk || 'medium'); // Use run's assessed risk
      const passed = expected === actual;

      return {
        id: `eval_${run.id}`,
        timestamp: run.startedAt.toISOString(),
        scenario: `${run.alert?.risk?.toUpperCase() || 'UNKNOWN'} risk alert - Customer ${run.alert?.customerId || 'unknown'}`,
        expected,
        actual,
        passed,
        latencyMs,
        details: passed ? undefined : `Expected ${expected} but got ${actual}`,
        alertId: run.alertId,
        runId: run.id,
      };
    });

    res.json(evalResults);
  } catch (error: any) {
    logger.error('Failed to fetch eval results', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to fetch evaluation results',
      message: error.message,
    });
  }
});

// Helper function to determine expected action based on risk
function getExpectedAction(risk: string): string {
  switch (risk) {
    case 'high':
      return 'freeze_card';
    case 'medium':
      return 'contact_customer';
    case 'low':
      return 'mark_false_positive';
    default:
      return 'contact_customer';
  }
}
