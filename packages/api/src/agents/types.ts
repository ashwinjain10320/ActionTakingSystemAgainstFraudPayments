/**
 * Types and interfaces for the multi-agent system
 */

export interface AgentContext {
  customerId: string;
  alertId: string;
  runId: string;
  transactions: any[];
  customer: any;
  alert: any;
}

export interface ToolResult {
  ok: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export interface AgentStep {
  step: string;
  ok: boolean;
  duration: number;
  detail: any;
  fallbackUsed?: boolean;
}

export interface TriageResult {
  risk: 'low' | 'medium' | 'high';
  reasons: string[];
  recommendedAction?: string;
  plan: string[];
  steps: AgentStep[];
  fallbackUsed: boolean;
  latencyMs: number;
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface FraudSignals {
  velocityScore: number;
  deviceChange: boolean;
  mccRarity: number;
  priorChargebacks: number;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}
