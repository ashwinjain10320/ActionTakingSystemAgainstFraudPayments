import { BaseTool } from '../tools/BaseTool';
import { AgentContext, RiskLevel } from '../types';
import { prisma } from '../../lib/prisma';

/**
 * Fraud Detection Agent
 * Analyzes velocity, device changes, MCC rarity, and prior chargebacks
 * Returns risk score, reasons, and recommended action
 */
export class FraudAgent extends BaseTool {
  name = 'fraud';
  description = 'Detects fraud signals and calculates risk score';

  protected async run(context: AgentContext): Promise<any> {
    const { transactions, customerId } = context;

    // Calculate fraud signals
    const signals = {
      velocityScore: this.calculateVelocityScore(transactions),
      deviceChange: this.detectDeviceChange(transactions),
      mccRarity: this.calculateMccRarity(transactions),
      priorChargebacks: await this.getChargebackCount(customerId),
    };

    // Determine risk level
    let risk: RiskLevel;
    const reasons: string[] = [];
    let action: string;

    // High risk conditions
    if (signals.velocityScore > 10 || signals.priorChargebacks > 0) {
      risk = RiskLevel.HIGH;
      if (signals.velocityScore > 10) {
        reasons.push(`High velocity: ${signals.velocityScore} transactions in 24h`);
      }
      if (signals.priorChargebacks > 0) {
        reasons.push(`Prior chargebacks: ${signals.priorChargebacks}`);
      }
      action = 'freeze_card';
    }
    // Medium risk conditions
    else if (signals.velocityScore > 5 || signals.deviceChange || signals.mccRarity < 0.1) {
      risk = RiskLevel.MEDIUM;
      if (signals.velocityScore > 5) {
        reasons.push(`Elevated velocity: ${signals.velocityScore} transactions in 24h`);
      }
      if (signals.deviceChange) {
        reasons.push('Multiple devices detected');
      }
      if (signals.mccRarity < 0.1) {
        reasons.push('Unusual merchant category');
      }
      action = 'freeze_card';
    }
    // Low risk
    else {
      risk = RiskLevel.LOW;
      reasons.push('No significant fraud signals detected');
      action = 'mark_false_positive';
    }

    return {
      signals,
      risk,
      reasons,
      action,
      score: this.calculateOverallScore(signals),
    };
  }

  /**
   * Calculate velocity score (transactions in last 24 hours)
   */
  private calculateVelocityScore(transactions: any[]): number {
    if (!transactions || transactions.length === 0) return 0;

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    return transactions.filter((txn) => new Date(txn.timestamp) >= oneDayAgo).length;
  }

  /**
   * Detect if multiple devices were used
   */
  private detectDeviceChange(transactions: any[]): boolean {
    if (!transactions || transactions.length === 0) return false;

    const devices = new Set(
      transactions.filter((txn) => txn.deviceId).map((txn) => txn.deviceId)
    );

    return devices.size > 1;
  }

  /**
   * Calculate MCC rarity (unusual merchant categories)
   */
  private calculateMccRarity(transactions: any[]): number {
    if (!transactions || transactions.length === 0) return 1.0;

    const mccCounts = new Map<string, number>();
    let totalCount = 0;

    // Count all MCCs
    for (const txn of transactions) {
      const mcc = txn.mcc || 'unknown';
      mccCounts.set(mcc, (mccCounts.get(mcc) || 0) + 1);
      totalCount++;
    }

    // Get the most recent transaction's MCC
    const recentMcc = transactions[0]?.mcc;
    if (!recentMcc) return 1.0;

    // Return frequency of that MCC
    const mccCount = mccCounts.get(recentMcc) || 0;
    return mccCount / totalCount;
  }

  /**
   * Get count of prior chargebacks for customer
   */
  private async getChargebackCount(customerId: string): Promise<number> {
    try {
      const count = await prisma.case.count({
        where: {
          customerId,
          type: 'chargeback',
        },
      });
      return count;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate overall fraud score (0-100)
   */
  private calculateOverallScore(signals: any): number {
    let score = 0;

    // Velocity contributes up to 40 points
    score += Math.min(signals.velocityScore * 4, 40);

    // Device change adds 20 points
    if (signals.deviceChange) {
      score += 20;
    }

    // MCC rarity (inverted) contributes up to 20 points
    score += (1 - signals.mccRarity) * 20;

    // Prior chargebacks add 20 points
    if (signals.priorChargebacks > 0) {
      score += 20;
    }

    return Math.min(Math.round(score), 100);
  }
}
