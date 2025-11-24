import { BaseTool } from '../tools/BaseTool';
import { AgentContext } from '../types';
import { prisma } from '../../lib/prisma';

/**
 * Knowledge Base Agent
 * Retrieves cited answers from local JSON knowledge base
 * Returns documents with title and anchor for citations
 */
export class KnowledgeBaseAgent extends BaseTool {
  name = 'kb';
  description = 'Searches knowledge base for relevant policies and procedures';

  protected async run(context: AgentContext): Promise<any> {
    const { alert } = context;

    // Determine search keywords based on alert type or context
    const keywords = this.extractKeywords(alert);

    // Search knowledge base
    const results = await this.searchKnowledgeBase(keywords);

    // Return top 3 results with citations
    return results.slice(0, 3).map((doc) => ({
      docId: doc.id,
      title: doc.title,
      anchor: doc.anchor || `#${doc.id}`,
      extract: this.extractSnippet(doc.content, 200),
    }));
  }

  /**
   * Extract search keywords from alert context
   */
  private extractKeywords(alert: any): string[] {
    const keywords: string[] = [];

    // Add alert-specific keywords
    if (alert.severity === 'high') {
      keywords.push('fraud', 'urgent');
    }

    // Add transaction-related keywords
    if (alert.transaction) {
      keywords.push('transaction', 'payment');
    }

    // Default keywords
    keywords.push('dispute', 'chargeback', 'customer');

    return keywords;
  }

  /**
   * Search knowledge base using keywords
   */
  private async searchKnowledgeBase(keywords: string[]): Promise<any[]> {
    try {
      // Search in kbDoc table
      const docs = await prisma.kbDoc.findMany({
        where: {
          OR: keywords.map((keyword) => ({
            OR: [
              { title: { contains: keyword, mode: 'insensitive' } },
              { contentText: { contains: keyword, mode: 'insensitive' } },
            ],
          })),
        },
        take: 5,
      });

      return docs;
    } catch (error) {
      // Return empty if KB not available
      return [];
    }
  }

  /**
   * Extract snippet from content
   */
  private extractSnippet(content: string, maxLength: number): string {
    if (!content) return '';

    const cleaned = content.replace(/\s+/g, ' ').trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    return cleaned.substring(0, maxLength) + '...';
  }
}
