import { BaseTool } from './BaseTool';
import { AgentContext } from '../types';

/**
 * Decision maker tool
 */
export class DecisionTool extends BaseTool {
  protected async run(context: AgentContext): Promise<any> {
    // This is a decision aggregator that doesn't need async operations
    const fraudResult = context as any;
    
    return {
      recommendedAction: fraudResult.action || 'mark_false_positive',
      confidence: 0.85,
    };
  }
}
