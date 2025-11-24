import { BaseTool } from '../tools/BaseTool';
import { AgentContext } from '../types';
import { prisma } from '../../lib/prisma';

/**
 * Compliance Agent
 * Enforces OTP/identity gates and policy restrictions
 * Checks KYC levels and action permissions
 */
export class ComplianceAgent extends BaseTool {
  name = 'compliance';
  description = 'Checks compliance requirements and policy restrictions';

  protected async run(context: AgentContext): Promise<any> {
    const { customer } = context;

    // Check KYC level for OTP requirement
    const requiresOTP = customer.kycLevel !== 'full';

    // Check for policy restrictions
    const policies = await this.checkPolicies(customer.id);

    // Check for active restrictions
    const restrictions = await this.checkRestrictions(customer.id);

    return {
      requiresOTP,
      kycLevel: customer.kycLevel,
      policies,
      restrictions,
      canFreeze: !restrictions.freezeBlocked,
      canDispute: !restrictions.disputeBlocked,
      complianceNotes: this.generateComplianceNotes(requiresOTP, policies, restrictions),
    };
  }

  /**
   * Check policy restrictions from database
   */
  private async checkPolicies(_customerId: string): Promise<any[]> {
    try {
      // Check if policy table exists by trying to query it
      const policies = await prisma.policy.findMany({
        where: {
          code: { in: ['freeze_card', 'dispute_creation', 'high_risk_action'] },
        },
        take: 10,
      });

      return policies.map((policy: any) => ({
        code: policy.code,
        title: policy.title,
        requiresApproval: policy.requiresApproval || false,
      }));
    } catch (error) {
      // Return empty if policies table doesn't exist
      return [];
    }
  }

  /**
   * Check active restrictions on customer account
   */
  private async checkRestrictions(customerId: string): Promise<any> {
    try {
      // Check for active cases that might block actions
      const activeCases = await prisma.case.count({
        where: {
          customerId,
          status: { in: ['OPEN', 'PENDING'] },
          type: { in: ['fraud_investigation', 'account_review'] },
        },
      });

      return {
        freezeBlocked: activeCases > 0,
        disputeBlocked: false, // Disputes are usually allowed
        hasActiveCases: activeCases > 0,
        caseCount: activeCases,
      };
    } catch (error) {
      return {
        freezeBlocked: false,
        disputeBlocked: false,
        hasActiveCases: false,
        caseCount: 0,
      };
    }
  }

  /**
   * Generate human-readable compliance notes
   */
  private generateComplianceNotes(requiresOTP: boolean, policies: any[], restrictions: any): string[] {
    const notes: string[] = [];

    if (requiresOTP) {
      notes.push('OTP verification required for sensitive actions');
    }

    if (policies.length > 0) {
      notes.push(`${policies.length} active compliance policies`);
    }

    if (restrictions.hasActiveCases) {
      notes.push(`${restrictions.caseCount} active investigation(s)`);
    }

    if (restrictions.freezeBlocked) {
      notes.push('Card freeze restricted due to active investigation');
    }

    return notes;
  }
}
