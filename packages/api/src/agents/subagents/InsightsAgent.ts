import { BaseTool } from '../tools/BaseTool';
import { AgentContext } from '../types';

/**
 * Insights Agent
 * Analyzes spending patterns, categories, and merchant concentration
 * Uses deterministic rules (no LLM dependency)
 */
export class InsightsAgent extends BaseTool {
  name = 'insights';
  description = 'Analyzes spending patterns and merchant concentration';

  protected async run(context: AgentContext): Promise<any> {
    const { transactions } = context;

    if (!transactions || transactions.length === 0) {
      return {
        categories: [],
        merchantConcentration: 0,
        spendPattern: 'unknown',
        avgTransactionAmount: 0,
        totalSpend: 0,
      };
    }

    // Group by MCC (Merchant Category Code)
    const mccGroups = new Map<string, number>();
    const merchantGroups = new Map<string, number>();
    let totalSpend = 0;

    for (const txn of transactions) {
      const mcc = txn.mcc || 'unknown';
      const merchant = txn.merchantName || 'unknown';
      const amount = Math.abs(txn.amountCents);

      mccGroups.set(mcc, (mccGroups.get(mcc) || 0) + 1);
      merchantGroups.set(merchant, (merchantGroups.get(merchant) || 0) + amount);
      totalSpend += amount;
    }

    // Category analysis
    const categories = Array.from(mccGroups.entries())
      .map(([name, count]) => ({
        name: this.getMccCategoryName(name),
        count,
        pct: (count / transactions.length) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Merchant concentration (Herfindahl index)
    const merchantConcentration = Array.from(merchantGroups.values()).reduce((sum, amount) => {
      const share = amount / totalSpend;
      return sum + share * share;
    }, 0);

    // Spend pattern analysis
    const amounts = transactions.map((txn) => Math.abs(txn.amountCents));
    const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgAmount;

    let spendPattern: string;
    if (coefficientOfVariation < 0.3) {
      spendPattern = 'consistent';
    } else if (coefficientOfVariation < 0.7) {
      spendPattern = 'variable';
    } else {
      spendPattern = 'highly_variable';
    }

    return {
      categories,
      merchantConcentration: Math.round(merchantConcentration * 100) / 100,
      spendPattern,
      avgTransactionAmount: Math.round(avgAmount),
      totalSpend,
      transactionCount: transactions.length,
    };
  }

  /**
   * Map MCC code to human-readable category
   */
  private getMccCategoryName(mcc: string): string {
    const categoryMap: Record<string, string> = {
      '4111': 'Transport',
      '5411': 'Retail',
      '5812': 'Food & Dining',
      '7011': 'Services',
      '8011': 'Healthcare',
      '4900': 'Utilities',
    };

    return categoryMap[mcc] || mcc;
  }
}
