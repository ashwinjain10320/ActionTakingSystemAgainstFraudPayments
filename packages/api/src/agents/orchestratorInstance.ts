import { Orchestrator } from './Orchestrator';

/**
 * Singleton orchestrator instance
 * Ensures all routes use the same orchestrator to avoid duplicate tool executions
 */
export const orchestrator = new Orchestrator();
