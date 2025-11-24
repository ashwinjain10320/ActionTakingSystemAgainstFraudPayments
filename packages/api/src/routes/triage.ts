import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { orchestrator } from '../agents/orchestratorInstance';
import { logger } from '../utils/logger';

const router = Router();

// Store active streams
const activeStreams = new Map<string, any>();

/**
 * POST /api/triage
 * Start a triage run
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { alertId } = req.body;

    if (!alertId) {
      return res.status(400).json({ error: 'Missing alertId' });
    }

    // Generate runId immediately
    const runId = `run_${Date.now()}_${alertId}`;

    // Start triage in background (don't await)
    orchestrator.executeTriage(alertId).catch((error) => {
      logger.error('Triage execution failed', { alertId, runId, error: error.message });
    });

    logger.info('Triage started', { alertId, runId });

    // Return immediately with runId
    return res.json({
      runId,
      alertId,
      status: 'started',
    });
  })
);

/**
 * GET /api/triage/:runId/stream
 * Stream triage events via SSE
 */
router.get(
  '/:runId/stream',
  asyncHandler(async (req, res) => {
    const { runId } = req.params;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', runId })}\n\n`);

    // Get alert from runId (in production, decode runId to get alertId)
    // For now, execute a new triage and stream it
    const { alertId } = req.query;

    if (!alertId || typeof alertId !== 'string') {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Missing alertId' })}\n\n`);
      res.end();
      return;
    }

    try {
      // Execute triage with streaming
      await orchestrator.executeTriage(alertId, (event) => {
        // Stream event to client
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      // Send completion event
      res.write(`data: ${JSON.stringify({ type: 'completed' })}\n\n`);
      res.end();
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }

    // Cleanup on disconnect
    req.on('close', () => {
      activeStreams.delete(runId);
    });
  })
);

/**
 * POST /api/triage/update-alert-status
 * Update alert status after an action is completed
 */
router.post(
  '/update-alert-status',
  asyncHandler(async (req, res) => {
    const { alertId, actionType } = req.body;

    if (!alertId || !actionType) {
      return res.status(400).json({ error: 'Missing alertId or actionType' });
    }

    // Update alert status through orchestrator
    await orchestrator.updateAlertStatusAfterAction(alertId, actionType);

    logger.info('Alert status updated via orchestrator', { alertId, actionType });

    return res.json({
      success: true,
      alertId,
      actionType,
    });
  })
);

/**
 * POST /api/triage/execute-action
 * Execute an action and update alert status atomically
 */
router.post(
  '/execute-action',
  asyncHandler(async (req, res) => {
    const { alertId, actionType, actionParams } = req.body;

    if (!alertId || !actionType) {
      return res.status(400).json({ error: 'Missing alertId or actionType' });
    }

    // Execute action and update alert through orchestrator
    const result = await orchestrator.executeActionAndUpdateAlert(alertId, actionType, actionParams);

    logger.info('Action executed and alert updated', { alertId, actionType, result });

    return res.json({
      success: true,
      alertId,
      actionType,
      alertStatus: result.alertStatus,
      actionResult: result.actionResult,
    });
  })
);

export const triageRouter = router;
