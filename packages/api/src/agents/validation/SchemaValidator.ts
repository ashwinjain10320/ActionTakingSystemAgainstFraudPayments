import { z, ZodError } from 'zod';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';

/**
 * Schema Validator for Tool I/O
 * Validates inputs and outputs against Zod schemas
 */
export class SchemaValidator {
  /**
   * Validate input against schema
   * @param toolName - Name of the tool
   * @param input - Input to validate
   * @param schema - Zod schema
   * @returns Validated input or throws error
   */
  static validateInput<T>(toolName: string, input: unknown, schema: z.ZodSchema<T>): T {
    try {
      const validated = schema.parse(input);
      metrics.schemaValidationTotal.inc({ tool: toolName, type: 'input', status: 'success' });
      return validated;
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error('Schema validation failed - input', {
          toolName,
          errors: error.errors,
          input,
        });

        metrics.schemaValidationTotal.inc({ tool: toolName, type: 'input', status: 'failure' });

        throw new Error(`Schema validation failed for ${toolName}: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validate output against schema
   * @param toolName - Name of the tool
   * @param output - Output to validate
   * @param schema - Zod schema
   * @returns Validated output or annotates trace on mismatch
   */
  static validateOutput<T>(
    toolName: string,
    output: unknown,
    schema: z.ZodSchema<T>,
    runId: string
  ): { valid: boolean; data: T | unknown; errors?: string[] } {
    try {
      const validated = schema.parse(output);
      metrics.schemaValidationTotal.inc({ tool: toolName, type: 'output', status: 'success' });
      return { valid: true, data: validated };
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);

        logger.warn('Schema validation failed - output', {
          toolName,
          runId,
          errors,
          output,
        });

        metrics.schemaValidationTotal.inc({ tool: toolName, type: 'output', status: 'failure' });

        // Annotate trace but don't throw - allow execution to continue
        return {
          valid: false,
          data: output,
          errors,
        };
      }
      throw error;
    }
  }

  /**
   * Safe parse - returns success flag without throwing
   */
  static safeParse<T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: string[] } {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return {
      success: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    };
  }
}

/**
 * Common schemas for agent tools
 */
export const AgentSchemas = {
  // Context input schema
  context: z.object({
    customerId: z.string(),
    alertId: z.string(),
    runId: z.string(),
    transactions: z.array(z.any()).optional(),
    customer: z.any().optional(),
    alert: z.any().optional(),
  }),

  // Fraud agent output
  fraudOutput: z.object({
    signals: z.object({
      velocityScore: z.number(),
      deviceChange: z.boolean(),
      mccRarity: z.number(),
      priorChargebacks: z.number(),
    }),
    risk: z.enum(['low', 'medium', 'high']),
    reasons: z.array(z.string()),
    action: z.string(),
    score: z.number().min(0).max(100),
  }),

  // Decision output
  decisionOutput: z.object({
    risk: z.enum(['low', 'medium', 'high']),
    reasons: z.array(z.string()),
    confidence: z.number().min(0).max(1).optional(),
  }),

  // Action proposal output
  actionOutput: z.object({
    actionType: z.enum(['freeze_card', 'open_dispute', 'contact_customer', 'mark_false_positive']),
    params: z.record(z.any()).optional(),
    rationale: z.string().optional(),
  }),
};
