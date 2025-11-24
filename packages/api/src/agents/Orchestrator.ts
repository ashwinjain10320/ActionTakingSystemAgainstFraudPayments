import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import {
  BaseTool,
  DataAccessAgent,
  DecisionTool,
  ProposeActionTool,
} from './tools/index';
import {
  InsightsAgent,
  FraudAgent,
  KnowledgeBaseAgent,
  ComplianceAgent,
  RedactorAgent,
  SummarizerAgent,
} from './subagents';
import { AgentContext, AgentStep, TriageResult, RiskLevel } from './types';

/**
 * Multi-Agent Orchestrator
 * Coordinates execution of sub-agents with timeouts, retries, and fallbacks
 */
export class Orchestrator {
  private readonly flowBudget = 5000; // 5 seconds total
  private readonly defaultPlan = [
    'dataAccess',
    'riskSignals',
    'kbLookup',
    'decide',
    'proposeAction',
  ];

  private tools: Map<string, BaseTool>;

  constructor() {
    this.tools = new Map<string, BaseTool>([
      // Core data retrieval
      ['dataAccess', new DataAccessAgent()],
      
      // Specialized sub-agents
      ['insights', new InsightsAgent()],
      ['riskSignals', new FraudAgent()],
      ['kbLookup', new KnowledgeBaseAgent()],
      ['compliance', new ComplianceAgent()],
      ['redactor', new RedactorAgent()],
      ['summarizer', new SummarizerAgent()],
      
      // Decision and action tools
      ['decide', new DecisionTool()],
      ['proposeAction', new ProposeActionTool()],
    ]);
  }

  /**
   * Execute triage workflow with SSE streaming
   * @param alertId - Alert to triage
   * @param streamCallback - Callback for streaming events
   */
  async executeTriage(
    alertId: string,
    streamCallback?: (event: any) => void
  ): Promise<TriageResult> {
    const startTime = Date.now();
    const runId = nanoid();

    // Get alert details
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        transaction: true,
        customer: true,
      },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    // Create triage run
    await prisma.triageRun.create({
      data: {
        id: runId,
        alertId,
        startedAt: new Date(),
      },
    });

    // Build context
    const context: AgentContext = {
      customerId: alert.customerId,
      alertId,
      runId,
      transactions: [],
      customer: alert.customer,
      alert,
    };

    // Execute plan
    const plan = this.defaultPlan;
    const steps: AgentStep[] = [];
    let fallbackUsed = false;
    let insightsResult: any = null;
    let riskResult: any = null;
    let kbResults: any = null;
    let complianceResult: any = null;
    let redactorResult: any = null;
    let proposalResult: any = null;

    // Stream plan_built event
    this.streamEvent(streamCallback, {
      type: 'plan_built',
      plan,
      runId,
    });

    logger.logEvent({
      event: 'plan_built',
      runId,
      alertId,
      plan,
    });

    // Execute each step
    for (const step of plan) {
      const stepStartTime = Date.now();
      const tool = this.tools.get(step);

      if (!tool) {
        logger.error(`Tool not found: ${step}`, { runId });
        continue;
      }

      try {
        // Check if we're within flow budget
        if (Date.now() - startTime > this.flowBudget) {
          logger.warn('Flow budget exceeded', { runId, step });
          break;
        }

        this.streamEvent(streamCallback, {
          type: 'tool_update',
          step,
          status: 'running',
          runId,
        });

        const result = await tool.execute(context);
        const duration = Date.now() - stepStartTime;

        // Store results in context for next steps
        if (step === 'dataAccess' && result.ok) {
          context.customer = result.data.customer;
          context.transactions = result.data.transactions;
        } else if (step === 'insights' && result.ok) {
          insightsResult = result.data;
        } else if (step === 'riskSignals' && result.ok) {
          riskResult = result.data;
          // Pass riskResult to context for later tools
          (context as any).riskResult = riskResult;
        } else if (step === 'kbLookup' && result.ok) {
          kbResults = result.data;
        } else if (step === 'compliance' && result.ok) {
          complianceResult = result.data;
          // Pass complianceResult to context for later tools
          (context as any).complianceResult = complianceResult;
        } else if (step === 'redactor' && result.ok) {
          redactorResult = result.data;
        } else if (step === 'proposeAction' && result.ok) {
          proposalResult = result.data;
        }

        // Record step
        const agentStep: AgentStep = {
          step,
          ok: result.ok,
          duration,
          detail: result.data || { error: result.error },
          fallbackUsed: !result.ok,
        };

        steps.push(agentStep);

        // Save trace
        await prisma.agentTrace.create({
          data: {
            runId,
            seq: steps.length,
            step,
            ok: result.ok,
            durationMs: duration,
            detailJson: agentStep.detail,
          },
        });

        if (!result.ok) {
          fallbackUsed = true;
          metrics.agentFallbackTotal.inc({ tool: step });

          this.streamEvent(streamCallback, {
            type: 'fallback_triggered',
            step,
            reason: result.error,
            runId,
          });

          logger.logEvent({
            event: 'fallback_triggered',
            runId,
            step,
            reason: result.error,
          });

          // Use fallback
          if (step === 'riskSignals') {
            riskResult = this.getFallbackRisk();
          }
        } else {
          this.streamEvent(streamCallback, {
            type: 'tool_update',
            step,
            status: 'completed',
            duration,
            runId,
          });
        }

        logger.logEvent({
          event: 'tool_invoked',
          runId,
          step,
          ok: result.ok,
          duration,
        });
      } catch (error: any) {
        logger.error(`Step ${step} failed`, { error: error.message, runId });
        fallbackUsed = true;

        steps.push({
          step,
          ok: false,
          duration: Date.now() - stepStartTime,
          detail: { error: error.message },
          fallbackUsed: true,
        });
      }
    }

    // Make final decision
    const risk = riskResult?.risk || RiskLevel.MEDIUM;
    const reasons = riskResult?.reasons || ['Risk assessment unavailable (fallback)'];
    const recommendedAction = proposalResult?.action || riskResult?.action || 'contact_customer';

    // Add compliance requirements to reasons
    if (complianceResult?.requiresOTP) {
      reasons.push('OTP verification required');
    }

    // Add KB citations
    if (kbResults && kbResults.length > 0) {
      reasons.push(`KB refs: ${kbResults.map((kb: any) => kb.title).join(', ')}`);
    }

    // Add insights summary
    if (insightsResult) {
      reasons.push(`Spend pattern: ${insightsResult.spendPattern}`);
    }

    // Add redaction note if PII found
    if (redactorResult?.piiFound) {
      reasons.push('PII redacted from logs');
    }

    const latencyMs = Date.now() - startTime;

    // Update triage run
    await prisma.triageRun.update({
      where: { id: runId },
      data: {
        endedAt: new Date(),
        risk,
        reasons,
        fallbackUsed,
        latencyMs,
      },
    });

    // Stream final decision
    this.streamEvent(streamCallback, {
      type: 'decision_finalized',
      risk,
      reasons,
      recommendedAction,
      latencyMs,
      runId,
    });

    logger.logEvent({
      event: 'decision_finalized',
      runId,
      risk,
      latencyMs,
    });

    return {
      risk,
      reasons,
      recommendedAction,
      plan,
      steps,
      fallbackUsed,
      latencyMs,
    };
  }

  /**
   * Stream event to client
   */
  private streamEvent(callback: ((event: any) => void) | undefined, event: any): void {
    if (callback) {
      callback(event);
    }
  }

  /**
   * Get fallback risk assessment when fraud tool fails
   */
  private getFallbackRisk(): any {
    return {
      risk: RiskLevel.MEDIUM,
      reasons: ['Risk assessment unavailable (fallback)'],
      action: 'freeze_card',
    };
  }

  /**
   * Execute an action and update alert status atomically
   * @param alertId - Alert ID to take action on
   * @param actionType - Type of action (freeze_card, open_dispute, contact_customer, mark_false_positive)
   * @param actionParams - Parameters for the action
   */
  async executeActionAndUpdateAlert(
    alertId: string,
    actionType: string,
    actionParams: any
  ): Promise<{ actionResult: any; alertStatus: string }> {
    try {
      // Get alert details
      const alert = await prisma.alert.findUnique({
        where: { id: alertId },
        include: { customer: true, transaction: true },
      });

      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      // Determine new alert status based on action type
      let newStatus: string;
      
      switch (actionType) {
        case 'freeze_card':
          newStatus = 'resolved'; // Card frozen successfully
          break;
        case 'open_dispute':
          newStatus = 'disputed'; // Dispute case opened
          break;
        case 'contact_customer':
          newStatus = 'pending_customer'; // Awaiting customer response
          break;
        case 'mark_false_positive':
          newStatus = 'false_positive'; // Dismissed as false positive
          break;
        default:
          newStatus = 'resolved';
      }

      // Execute action (this would call the action endpoint internally or directly execute)
      // For now, we just simulate the action result
      const actionResult = {
        actionType,
        params: actionParams,
        timestamp: new Date(),
      };

      // Update alert status
      await prisma.alert.update({
        where: { id: alertId },
        data: { status: newStatus },
      });

      logger.logEvent({
        event: 'action_executed_and_alert_updated',
        alertId,
        actionType,
        newStatus,
        actionParams,
      });

      return {
        actionResult,
        alertStatus: newStatus,
      };
    } catch (error: any) {
      logger.error('Failed to execute action and update alert', {
        alertId,
        actionType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update alert status after action is completed externally
   * @param alertId - Alert associated with the action
   * @param actionType - Type of action that was taken
   */
  async updateAlertStatusAfterAction(alertId: string, actionType: string): Promise<void> {
    try {
      // Determine status based on action type
      let newStatus: string;
      
      switch (actionType) {
        case 'freeze_card':
          newStatus = 'resolved';
          break;
        case 'open_dispute':
          newStatus = 'disputed';
          break;
        case 'contact_customer':
          newStatus = 'pending_customer';
          break;
        case 'mark_false_positive':
          newStatus = 'false_positive';
          break;
        default:
          newStatus = 'resolved';
      }

      await prisma.alert.update({
        where: { id: alertId },
        data: { status: newStatus },
      });

      logger.logEvent({
        event: 'alert_status_updated',
        alertId,
        actionType,
        newStatus,
      });
    } catch (error) {
      logger.error('Failed to update alert status', { alertId, actionType, error });
    }
  }
}
