import { z } from 'zod';
import { BaseTool } from '../tools/BaseTool';
import { AgentContext, RiskLevel } from '../types';

/**
 * Summarizer Agent Schema
 * Validates output with fallback to template-based generation
 */
const SummarizerOutputSchema = z.object({
  customerMessage: z.string().min(10).max(500),
  internalNote: z.string().min(10).max(1000),
  tone: z.enum(['urgent', 'standard', 'reassuring']),
});

/**
 * Summarizer Agent
 * Generates customer-facing messages and internal notes
 * Uses template fallback (no LLM dependency required)
 */
export class SummarizerAgent extends BaseTool {
  name = 'summarizer';
  description = 'Generates customer messages and internal notes';

  protected async run(context: AgentContext): Promise<any> {
    const riskResult = (context as any).riskResult;
    const risk = riskResult?.risk || RiskLevel.MEDIUM;

    // Generate messages based on risk level
    const result = this.generateMessages(risk, riskResult);

    // Validate with schema
    try {
      return SummarizerOutputSchema.parse(result);
    } catch (error) {
      // Fallback to safe defaults
      return {
        customerMessage: 'We detected unusual activity on your account and are reviewing it for your protection.',
        internalNote: `Triage completed with ${risk} risk. Schema validation failed, using fallback message.`,
        tone: 'standard',
      };
    }
  }

  /**
   * Generate messages using deterministic templates
   */
  private generateMessages(risk: RiskLevel, riskResult: any): any {
    const reasons = riskResult?.reasons || [];

    switch (risk) {
      case RiskLevel.HIGH:
        return {
          customerMessage: 'We detected suspicious activity on your account and have temporarily frozen your card for your protection. Please contact us immediately at 1-800-SENTINEL.',
          internalNote: `HIGH RISK ALERT: ${reasons.join('; ')}. Card freeze recommended. Immediate customer contact required.`,
          tone: 'urgent' as const,
        };

      case RiskLevel.MEDIUM:
        return {
          customerMessage: 'We noticed some unusual activity on your account. Please review your recent transactions and contact us if you see anything unfamiliar.',
          internalNote: `MEDIUM RISK: ${reasons.join('; ')}. Customer verification recommended. Monitor for additional signals.`,
          tone: 'standard' as const,
        };

      case RiskLevel.LOW:
      default:
        return {
          customerMessage: 'We completed a routine security review of your account. No action is needed from you at this time.',
          internalNote: `LOW RISK: ${reasons.join('; ')}. Routine review completed. No immediate action required.`,
          tone: 'reassuring' as const,
        };
    }
  }

  /**
   * Generate customer message with context
   */
  public generateCustomerMessage(risk: RiskLevel, _actionTaken?: string): string {
    const templates = {
      [RiskLevel.HIGH]: 'Your card has been frozen due to suspicious activity. Please contact us immediately.',
      [RiskLevel.MEDIUM]: 'We detected unusual activity on your account. Please verify your recent transactions.',
      [RiskLevel.LOW]: 'Security review completed. Your account is secure.',
    };

    return templates[risk] || templates[RiskLevel.MEDIUM];
  }

  /**
   * Generate internal note with details
   */
  public generateInternalNote(risk: RiskLevel, reasons: string[], action?: string): string {
    const reasonText = reasons.length > 0 ? reasons.join('; ') : 'No specific reasons provided';
    const actionText = action ? `Recommended action: ${action}` : '';

    return `Risk: ${risk}. ${reasonText}. ${actionText}`.trim();
  }
}
