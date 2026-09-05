/**
 * LedgerLens — Reconciliation Engine & Policy Unit Tests
 */

import { DeterministicReconciliationEngine } from '../services/reconciliation/deterministicEngine';
import { ExceptionEngine } from '../services/reconciliation/exceptionEngine';
import { AIInvestigationService } from '../services/ai/aiInvestigationService';
import { PolicyEngine } from '../services/policy/policyEngine';
import {
  PaymentRecord,
  SettlementRecord,
  BankTransactionRecord,
} from '../types/reconciliation';

describe('Deterministic Reconciliation Engine', () => {
  const engine = new DeterministicReconciliationEngine();

  const mockPayment: PaymentRecord = {
    id: 'p-1',
    merchant_id: 'demo_merchant',
    payment_id: 'pay_123456',
    amount: 1000.0,
    currency: 'INR',
    status: 'captured',
    payment_date: '2026-03-01T10:00:00Z',
    source: 'csv',
  };

  const mockSettlement: SettlementRecord = {
    id: 's-1',
    merchant_id: 'demo_merchant',
    settlement_id: 'set_123456',
    amount: 1000.0,
    fees: 20.0,
    tax: 3.6,
    net_amount: 976.4,
    utr: 'UTR998877',
    settlement_date: '2026-03-02T12:00:00Z',
    status: 'processed',
    source: 'csv',
    metadata: { payment_id: 'pay_123456' },
  };

  const mockBankTx: BankTransactionRecord = {
    id: 'b-1',
    merchant_id: 'demo_merchant',
    bank_reference: 'BANK_REF_998877',
    utr: 'UTR998877',
    amount: 976.4,
    transaction_type: 'credit',
    transaction_date: '2026-03-02T14:00:00Z',
    source: 'csv',
  };

  it('correctly performs 3-way exact matching on matching records', () => {
    const results = engine.reconcile([mockPayment], [mockSettlement], [mockBankTx]);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('matched');
    expect(results[0].confidenceScore).toBe(1.0);
    expect(results[0].differenceAmount).toBe(0);
    expect(results[0].settlement?.id).toBe('s-1');
    expect(results[0].bankTransaction?.id).toBe('b-1');
  });

  it('detects MISSING_BANK when settlement exists without bank credit', () => {
    const results = engine.reconcile([mockPayment], [mockSettlement], []);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('exception');
    expect(results[0].exceptionType).toBe('MISSING_BANK');
    expect(results[0].differenceAmount).toBe(976.4);
  });

  it('detects MISSING_SETTLEMENT when payment exists without settlement', () => {
    const results = engine.reconcile([mockPayment], [], []);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('exception');
    expect(results[0].exceptionType).toBe('MISSING_SETTLEMENT');
    expect(results[0].differenceAmount).toBe(1000.0);
  });
});

describe('Exception Engine', () => {
  const exceptionEngine = new ExceptionEngine();

  it('classifies severity and priority correctly based on risk amounts', () => {
    const mockResult = {
      payment: { id: 'p-1', amount: 50000 } as any,
      settlement: null,
      bankTransaction: null,
      status: 'exception' as const,
      confidenceScore: 0,
      differenceAmount: 50000,
      exceptionType: 'MISSING_SETTLEMENT' as const,
      reason: 'No settlement record',
    };

    const exceptions = exceptionEngine.processExceptions([mockResult]);
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].exceptionType).toBe('MISSING_SETTLEMENT');
    expect(exceptions[0].amountAtRisk).toBe(50000);
    expect(exceptions[0].severity).toBe('HIGH');
    expect(exceptions[0].priority).toBeLessThanOrEqual(25);
  });
});

describe('Risk-Adjusted Policy Engine', () => {
  const policyEngine = new PolicyEngine();

  it('allows AUTO_RESOLVE for low risk amount with high confidence on safe types', () => {
    const aiOutput = {
      explanation: 'Standard 2% MDR fee variance verified',
      model: 'test-model',
      confidence: 0.98,
      decision: 'AUTO_RESOLVE' as const,
      evidenceIds: ['p-1', 's-1'],
      suggestedAction: 'Accept variance',
      reasoning: 'Interchange contract verified',
    };

    const policy = policyEngine.evaluate(aiOutput, 'FEE_DIFFERENCE', 25.0);
    expect(policy.finalDecision).toBe('AUTO_RESOLVE');
    expect(policy.autoResolveAllowed).toBe(true);
    expect(policy.ruleApplied).toBe('POLICY_SAFE_AUTO_RESOLVE');
  });

  it('forces REVIEW when amount at risk exceeds high threshold', () => {
    const aiOutput = {
      explanation: 'High value fee discrepancy',
      model: 'test-model',
      confidence: 0.99,
      decision: 'AUTO_RESOLVE' as const,
      evidenceIds: ['p-1'],
      suggestedAction: 'Accept',
      reasoning: 'Fee match',
    };

    const policy = policyEngine.evaluate(aiOutput, 'FEE_DIFFERENCE', 250000.0);
    expect(policy.finalDecision).toBe('REVIEW');
    expect(policy.autoResolveAllowed).toBe(false);
    expect(policy.ruleApplied).toBe('POLICY_HIGH_VALUE_MANDATORY_REVIEW');
  });

  it('refuses to resolve and outputs UNRESOLVED when confidence is low', () => {
    const aiOutput = {
      explanation: 'Ambiguous source records',
      model: 'test-model',
      confidence: 0.45,
      decision: 'UNRESOLVED' as const,
      evidenceIds: [],
      suggestedAction: 'Inspect manually',
      reasoning: 'Missing metadata',
    };

    const policy = policyEngine.evaluate(aiOutput, 'UNKNOWN', 1200.0);
    expect(policy.finalDecision).toBe('UNRESOLVED');
    expect(policy.ruleApplied).toBe('POLICY_INSUFFICIENT_CONFIDENCE_UNRESOLVED');
  });
});

describe('AI Investigation Fallback', () => {
  const aiService = new AIInvestigationService();

  it('returns valid structured output from heuristic investigation', async () => {
    const result = await aiService.investigate({
      exceptionType: 'FEE_DIFFERENCE',
      differenceAmount: 20.0,
      amountAtRisk: 20.0,
      payment: { id: 'p-1', amount: 1000 } as any,
      settlement: { id: 's-1', amount: 1000, fees: 20, net_amount: 976.4 } as any,
    });

    expect(result.explanation).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(['AUTO_RESOLVE', 'REVIEW', 'UNRESOLVED']).toContain(result.decision);
    expect(Array.isArray(result.evidenceIds)).toBe(true);
  });
});
