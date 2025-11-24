import { AgentContext, ToolResult } from '../types';
import { circuitBreaker } from '../CircuitBreaker';
import { metrics } from '../../utils/metrics';
import { logger } from '../../utils/logger';

/**
 * Base class for agent tools with timeout and retry logic
 */
export abstract class BaseTool {
  protected timeout: number = 1000; // 1 second
  protected maxRetries: number = 2;
  protected retryDelays: number[] = [150, 400]; // ms with jitter

  /**
   * Execute tool with timeout, retries, and circuit breaker
   */
  async execute(context: AgentContext): Promise<ToolResult> {
    const startTime = Date.now();
    const toolName = this.constructor.name;

    try {
      const result = await circuitBreaker.execute(toolName, async () => {
        return await this.executeWithRetry(context);
      });

      const duration = Date.now() - startTime;

      metrics.toolCallTotal.inc({ tool: toolName, ok: 'true' });
      metrics.agentLatency.observe({ agent: toolName, step: 'execute' }, duration);

      return {
        ok: true,
        data: result,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error(`Tool ${toolName} failed`, {
        error: error.message,
        duration,
        runId: context.runId,
      });

      metrics.toolCallTotal.inc({ tool: toolName, ok: 'false' });

      return {
        ok: false,
        error: error.message,
        duration,
      };
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(context: AgentContext): Promise<any> {
    const toolName = this.constructor.name;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`🔄 [${toolName}] Retry attempt ${attempt} of ${this.maxRetries}`, {
            runId: context.runId,
          });
        }
        
        const result = await this.executeWithTimeout(context);
        
        if (attempt > 0) {
          logger.info(`✅ [${toolName}] Succeeded on attempt ${attempt + 1}`, {
            runId: context.runId,
          });
        }
        
        return result;
      } catch (error: any) {
        lastError = error;
        
        logger.warn(`❌ [${toolName}] Attempt ${attempt + 1} failed: ${error.message}`, {
          runId: context.runId,
          attempt: attempt + 1,
          maxRetries: this.maxRetries + 1,
        });

        if (attempt < this.maxRetries) {
          const delay = this.retryDelays[attempt] + Math.random() * 50; // Add jitter
          logger.info(`⏳ [${toolName}] Waiting ${Math.round(delay)}ms before retry...`, {
            runId: context.runId,
          });
          await this.sleep(delay);
        } else {
          logger.error(`💥 [${toolName}] All ${this.maxRetries + 1} attempts exhausted`, {
            runId: context.runId,
          });
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout(context: AgentContext): Promise<any> {
    return Promise.race([
      this.run(context),
      this.timeoutPromise(),
    ]);
  }

  /**
   * Create timeout promise
   */
  private timeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tool timeout exceeded')), this.timeout);
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Abstract method to be implemented by subclasses
   */
  protected abstract run(context: AgentContext): Promise<any>;
}
