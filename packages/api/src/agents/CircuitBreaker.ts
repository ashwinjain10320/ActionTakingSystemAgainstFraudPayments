import { CircuitBreakerState } from './types';
import { logger } from '../utils/logger';

/**
 * Circuit Breaker implementation for agent tools
 * Opens circuit after 3 consecutive failures for 30 seconds
 */
export class CircuitBreaker {
  private states: Map<string, CircuitBreakerState> = new Map();
  private readonly failureThreshold = 3;
  private readonly openDuration = 30000; // 30 seconds

  /**
   * Execute a function with circuit breaker protection
   * @param toolName - Name of the tool being executed
   * @param fn - Function to execute
   * @returns Result of the function execution
   */
  async execute<T>(toolName: string, fn: () => Promise<T>): Promise<T> {
    const state = this.getState(toolName);

    // Check if circuit is open
    if (state.isOpen) {
      const now = Date.now();
      if (now - state.lastFailureTime < this.openDuration) {
        logger.warn('Circuit breaker is open', { toolName });
        throw new Error(`Circuit breaker open for ${toolName}`);
      } else {
        // Reset circuit after cooldown
        this.resetCircuit(toolName);
      }
    }

    try {
      const result = await fn();
      this.onSuccess(toolName);
      return result;
    } catch (error) {
      this.onFailure(toolName);
      throw error;
    }
  }

  /**
   * Get or initialize circuit breaker state for a tool
   */
  private getState(toolName: string): CircuitBreakerState {
    if (!this.states.has(toolName)) {
      this.states.set(toolName, {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false,
      });
    }
    return this.states.get(toolName)!;
  }

  /**
   * Handle successful execution
   */
  private onSuccess(toolName: string): void {
    const state = this.getState(toolName);
    state.failures = 0;
    state.isOpen = false;
  }

  /**
   * Handle failed execution
   */
  private onFailure(toolName: string): void {
    const state = this.getState(toolName);
    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.failures >= this.failureThreshold) {
      state.isOpen = true;
      logger.error('Circuit breaker opened', {
        toolName,
        failures: state.failures,
      });
    }
  }

  /**
   * Reset circuit breaker for a tool
   */
  private resetCircuit(toolName: string): void {
    this.states.set(toolName, {
      failures: 0,
      lastFailureTime: 0,
      isOpen: false,
    });
    logger.info('Circuit breaker reset', { toolName });
  }

  /**
   * Check if circuit is open for a tool
   */
  isOpen(toolName: string): boolean {
    return this.getState(toolName).isOpen;
  }
}

export const circuitBreaker = new CircuitBreaker();
