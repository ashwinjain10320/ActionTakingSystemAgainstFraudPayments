import { Router } from 'express';
import { ingestRouter } from './ingest';
import { customerRouter } from './customer';
import { insightsRouter } from './insights';
import { triageRouter } from './triage';
import { actionRouter } from './action';
import { kbRouter } from './kb';
import { alertsRouter } from './alerts';
import { statsRouter } from './stats';

/**
 * Main API router
 * Combines all route modules
 */
const router = Router();

// Mount route modules
router.use('/ingest', ingestRouter);
router.use('/customer', customerRouter);
router.use('/insights', insightsRouter);
router.use('/triage', triageRouter);
router.use('/action', actionRouter);
router.use('/kb', kbRouter);
router.use('/alerts', alertsRouter);
router.use('/stats', statsRouter);

export const apiRoutes = router;
