/**
 * LedgerLens — Risk-Adjusted Policy Engine
 *
 * Combines AI confidence, exception type, and financial risk (amount at risk)
 * to make deterministic governance decisions:
 *
 *   AUTO_RESOLVE: High confidence + low financial risk + benign exception
 *   REVIEW:       Moderate confidence OR high financial risk OR critical exception
 *   UNRESOLVED:   Low confidence OR missing evidence (refusal to guess)
 */

import {
  AIInvestigationOutput,
  ExceptionType,
  FinalDecision,
  PolicyEvaluationResult,
} from '../../types/reconciliation';

export class PolicyEngine {
  private highConfidenceThreshold: number;
  private lowConfidenceThreshold: number;
  private lowRiskAmount: number;
  private highRiskAmount: number;

  constructor() {
    this.highConfidenceThreshold = Number(process.env.POLICY_HIGH_CONFIDENCE_THRESHOLD || 0.95);
    this.lowConfidenceThreshold = Number(process.env.POLICY_LOW_CONFIDENCE_THRESHOLD || 0.75);
    this.lowRiskAmount = Number(process.env.POLICY_LOW_RISK_AMOUNT || 10000);
    this.highRiskAmount = Number(process.env.POLICY_HIGH_RISK_AMOUNT || 100000);
  }

  /**
   * Evaluates AI investigation and risk metrics to produce the final governance decision.
   */
  public evaluate(
    aiOutput: AIInvestigationOutput,
    exceptionType: ExceptionType,
    amountAtRisk: number
  ): PolicyEvaluationResult {
    const { confidence, decision: aiDecision } = aiOutput;

    // Rule 1: High risk or duplicate triggers mandatory human review regardless of confidence
    if (amountAtRisk >= this.highRiskAmount) {
      return {
        ruleApplied: 'POLICY_HIGH_VALUE_MANDATORY_REVIEW',
        finalDecision: 'REVIEW',
        autoResolveAllowed: false,
        notes: `Amount at risk (₹${amountAtRisk.toLocaleString('en-IN')}) exceeds high-risk threshold (₹${this.highRiskAmount.toLocaleString('en-IN')}). Controller sign-off required.`,
      };
    }

    if (exceptionType === 'DUPLICATE') {
      return {
        ruleApplied: 'POLICY_DUPLICATE_MANDATORY_REVIEW',
        finalDecision: 'REVIEW',
        autoResolveAllowed: false,
        notes: 'Potential duplicate transaction requires manual verification to prevent double-crediting.',
      };
    }

    // Rule 2: Insufficient confidence / lack of evidence -> UNRESOLVED
    if (confidence < this.lowConfidenceThreshold || aiDecision === 'UNRESOLVED') {
      return {
        ruleApplied: 'POLICY_INSUFFICIENT_CONFIDENCE_UNRESOLVED',
        finalDecision: 'UNRESOLVED',
        autoResolveAllowed: false,
        notes: `Confidence score (${(confidence * 100).toFixed(1)}%) is below acceptable threshold (${(this.lowConfidenceThreshold * 100).toFixed(1)}%). System refuses to guess.`,
      };
    }

    // Rule 3: Safe exception types + High Confidence + Low Risk Amount -> AUTO_RESOLVE
    const safeAutoResolveTypes: ExceptionType[] = [
      'FEE_DIFFERENCE',
      'TAX_DIFFERENCE',
      'DATE_DIFFERENCE',
    ];

    if (
      aiDecision === 'AUTO_RESOLVE' &&
      confidence >= this.highConfidenceThreshold &&
      amountAtRisk <= this.lowRiskAmount &&
      safeAutoResolveTypes.includes(exceptionType)
    ) {
      return {
        ruleApplied: 'POLICY_SAFE_AUTO_RESOLVE',
        finalDecision: 'AUTO_RESOLVE',
        autoResolveAllowed: true,
        notes: `Safe exception ${exceptionType} with high confidence (${(confidence * 100).toFixed(1)}%) under risk ceiling. Auto-resolution authorized.`,
      };
    }

    // Rule 4: Otherwise, route for human controller review
    return {
      ruleApplied: 'POLICY_STANDARD_REVIEW_ROUTED',
      finalDecision: 'REVIEW',
      autoResolveAllowed: false,
      notes: `Exception routed for finance controller review (Confidence: ${(confidence * 100).toFixed(1)}%, Amount: ₹${amountAtRisk.toFixed(2)}).`,
    };
  }
}
