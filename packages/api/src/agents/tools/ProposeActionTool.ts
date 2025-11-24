import { z } from 'zod';
import { BaseTool } from './BaseTool';
import { AgentContext } from '../types';
import { logger } from '../../utils/logger';

/**
 * Propose Action Tool
 * Final decision on recommended action with compliance checks
 */
export class ProposeActionTool extends BaseTool {
  private actionSchema = z.object({
    action: z.enum(['freeze_card', 'open_dispute', 'contact_customer', 'mark_false_positive']),
    confidence: z.number().min(0).max(1),
    requiresApproval: z.boolean(),
    blockedByPolicy: z.boolean().optional(),
  });

  protected async run(context: AgentContext): Promise<any> {
    const riskResult = (context as any).riskResult;
    const complianceResult = (context as any).complianceResult;
    
    let action = riskResult?.action || 'mark_false_positive';
    let confidence = 0.75;
    let requiresApproval = false;
    let blockedByPolicy = false;

    // Check if action is blocked by compliance
    if (action === 'freeze_card' && complianceResult?.requiresOTP) {
      requiresApproval = true;
    }

    // High confidence for clear cases
    if (riskResult?.risk === 'high' && riskResult?.reasons?.length > 2) {
      confidence = 0.92;
    } else if (riskResult?.risk === 'low') {
      confidence = 0.85;
    }

    const proposal = {
      action,
      confidence,
      requiresApproval,
      blockedByPolicy,
    };

    try {
      return this.actionSchema.parse(proposal);
    } catch (error) {
      logger.error('Action proposal schema validation failed', { error });
      return {
        action: 'contact_customer',
        confidence: 0.5,
        requiresApproval: true,
        blockedByPolicy: false,
      };
    }
  }
}
