import { BaseTool } from './BaseTool';
import { AgentContext } from '../types';
import { prisma } from '../../lib/prisma';

/**
 * Data Access Agent
 * Fetches customer profile and transaction data
 */
export class DataAccessAgent extends BaseTool {
  name = 'dataAccess';
  description = 'Fetches customer profile and recent transactions';

  protected async run(context: AgentContext): Promise<any> {
    const [customer, transactions] = await Promise.all([
      this.getCustomerProfile(context.customerId),
      this.getRecentTransactions(context.customerId),
    ]);

    return { customer, transactions };
  }

  private async getCustomerProfile(customerId: string) {
    return prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        cards: true,
        accounts: true,
      },
    });
  }

  private async getRecentTransactions(customerId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return prisma.transaction.findMany({
      where: {
        customerId,
        ts: { gte: thirtyDaysAgo },
      },
      orderBy: { ts: 'desc' },
      take: 100,
    });
  }
}
