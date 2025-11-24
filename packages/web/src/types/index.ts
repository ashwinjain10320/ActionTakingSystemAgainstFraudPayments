export interface Customer {
  id: string;
  name: string;
  emailMasked: string;
  kycLevel: 'basic' | 'full';
  createdAt: string;
  cards?: Card[];
  accounts?: Account[];
}

export interface Card {
  id: string;
  customerId: string;
  last4: string;
  network: string;
  status: 'active' | 'frozen' | 'blocked';
  createdAt: string;
}

export interface Account {
  id: string;
  customerId: string;
  balanceCents: number;
  currency: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  cardId: string;
  mcc: string;
  merchant: string;
  amountCents: number;
  currency: string;
  ts: string;
  deviceId?: string;
  country?: string;
  city?: string;
}

export interface Alert {
  id: string;
  customerId: string;
  suspectTxnId: string;
  createdAt: string;
  risk: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved' | 'false_positive';
  transaction?: Transaction;
  customer?: Customer;
}

export interface TriageRun {
  id: string;
  alertId: string;
  startedAt: string;
  endedAt?: string;
  risk: 'low' | 'medium' | 'high';
  reasons: string[];
  fallbackUsed: boolean;
  latencyMs: number;
  traces?: AgentTrace[];
}

export interface AgentTrace {
  runId: string;
  seq: number;
  step: string;
  ok: boolean;
  durationMs: number;
  detailJson: any;
}

export interface Insights {
  topMerchants: { merchant: string; count: number }[];
  categories: { name: string; count: number; pct: number }[];
  monthlyTrend: { month: string; sum: number }[];
  anomalies: {
    ts: string;
    merchant: string;
    amountCents: number;
    z: string;
    note: string;
  }[];
  meta: {
    duration: number;
    transactionCount: number;
    period: string;
  };
}

export interface KBDoc {
  docId: string;
  title: string;
  anchor: string;
  extract: string;
}

export interface TriageEvent {
  type: 'connected' | 'plan_built' | 'tool_update' | 'fallback_triggered' | 'decision_finalized' | 'completed' | 'error';
  runId?: string;
  plan?: string[];
  step?: string;
  status?: string;
  duration?: number;
  reason?: string;
  risk?: string;
  reasons?: string[];
  recommendedAction?: string;
  latencyMs?: number;
  message?: string;
}

export interface Case {
  id: string;
  customerId: string;
  txnId?: string;
  type: string;
  status: string;
  reasonCode: string;
  createdAt: string;
}
