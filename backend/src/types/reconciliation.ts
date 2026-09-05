/**
 * LedgerLens — Reconciliation Domain Types
 */

export type ReconciliationStatus =
  | 'matched'
  | 'exception'
  | 'duplicate'
  | 'missing_bank'
  | 'missing_settlement'
  | 'pending';

export type ExceptionType =
  | 'FEE_DIFFERENCE'
  | 'TAX_DIFFERENCE'
  | 'DATE_DIFFERENCE'
  | 'MISSING_BANK'
  | 'MISSING_SETTLEMENT'
  | 'AMOUNT_MISMATCH'
  | 'DUPLICATE'
  | 'UNKNOWN';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FinalDecision = 'AUTO_RESOLVE' | 'REVIEW' | 'UNRESOLVED';

export type ResolutionMethod = 'deterministic' | 'ai_auto' | 'human';

export interface PaymentRecord {
  id: string;
  merchant_id: string;
  payment_id: string;
  customer_id?: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string | null;
  payment_date: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface SettlementRecord {
  id: string;
  merchant_id: string;
  settlement_id: string;
  amount: number;
  fees: number;
  tax: number;
  net_amount: number;
  utr?: string | null;
  settlement_date: string;
  status: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface BankTransactionRecord {
  id: string;
  merchant_id: string;
  bank_reference: string;
  utr?: string | null;
  amount: number;
  transaction_type: 'credit' | 'debit';
  transaction_date: string;
  description?: string | null;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface DeterministicMatchResult {
  payment: PaymentRecord;
  settlement?: SettlementRecord | null;
  bankTransaction?: BankTransactionRecord | null;
  status: ReconciliationStatus;
  matchingRule?: string;
  confidenceScore: number;
  differenceAmount: number;
  exceptionType?: ExceptionType | null;
  reason: string;
}

export interface AIInvestigationInput {
  exceptionType: ExceptionType;
  differenceAmount: number;
  amountAtRisk: number;
  payment?: PaymentRecord | null;
  settlement?: SettlementRecord | null;
  bankTransaction?: BankTransactionRecord | null;
}

export interface AIInvestigationOutput {
  explanation: string;
  model: string;
  confidence: number;
  decision: FinalDecision;
  evidenceIds: string[];
  suggestedAction: string;
  reasoning: string;
}

export interface PolicyEvaluationResult {
  ruleApplied: string;
  finalDecision: FinalDecision;
  autoResolveAllowed: boolean;
  notes: string;
}
