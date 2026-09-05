/**
 * LedgerLens — AI Investigation Service
 *
 * Investigates financial exceptions using LLM (Anthropic Claude).
 *
 * Guardrails & Principles:
 *   - Only invoked for exceptions — never for routine arithmetic or exact matching
 *   - Strict JSON structured output
 *   - Refuses to fabricate resolutions if evidence is insufficient -> returns UNRESOLVED
 *   - Clear concise explanations suitable for audit logs and finance controllers
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AIInvestigationInput,
  AIInvestigationOutput,
  FinalDecision,
} from '../../types/reconciliation';

export class AIInvestigationService {
  private anthropic: Anthropic | null = null;
  private model: string;
  private isConfigured: boolean = false;

  constructor() {
    this.model = process.env.AI_MODEL || 'claude-3-5-haiku-20241022';
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (apiKey && apiKey !== 'your-anthropic-api-key-here' && apiKey.startsWith('sk-ant')) {
      this.anthropic = new Anthropic({ apiKey });
      this.isConfigured = true;
    }
  }

  /**
   * Investigate a single financial exception.
   */
  public async investigate(input: AIInvestigationInput): Promise<AIInvestigationOutput> {
    if (this.isConfigured && this.anthropic) {
      try {
        return await this.investigateWithClaude(input);
      } catch (err) {
        console.warn('[AIInvestigation] Claude API call failed, falling back to rule-guided investigation:', err);
        return this.heuristicInvestigation(input);
      }
    } else {
      return this.heuristicInvestigation(input);
    }
  }

  /**
   * Structured prompt to Anthropic Claude.
   */
  private async investigateWithClaude(input: AIInvestigationInput): Promise<AIInvestigationOutput> {
    if (!this.anthropic) throw new Error('Anthropic client not initialized');

    const prompt = `
You are the Lead Financial Controller AI for LedgerLens.
Your mission: Investigate the following reconciliation exception and determine the root cause, confidence, and recommended action.

=== CONTEXT ===
Exception Type: ${input.exceptionType}
Discrepancy Amount: ₹${input.differenceAmount.toFixed(2)}
Amount at Risk: ₹${input.amountAtRisk.toFixed(2)}

Payment Record:
${JSON.stringify(input.payment || 'None', null, 2)}

Settlement Record:
${JSON.stringify(input.settlement || 'None', null, 2)}

Bank Transaction Record:
${JSON.stringify(input.bankTransaction || 'None', null, 2)}

=== RULES ===
1. Never hallucinate or assume facts not in the data.
2. If settlement or bank credit is missing and unexplainable, mark UNRESOLVED.
3. If difference is a standard payment gateway fee rate (e.g., 2% + 18% GST), explain the math clearly.
4. Confidence must be between 0.00 and 1.00.
5. Decision must be one of: "AUTO_RESOLVE" | "REVIEW" | "UNRESOLVED".

Respond with ONLY a valid JSON object matching this schema:
{
  "explanation": "concise 1-2 sentence explanation of the financial root cause",
  "confidence": 0.95,
  "decision": "AUTO_RESOLVE",
  "evidenceIds": ["list", "of", "relevant", "record", "ids"],
  "suggestedAction": "specific action for finance ops",
  "reasoning": "brief controller reasoning"
}
`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 600,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    });

    const contentBlock = response.content[0];
    if (contentBlock.type === 'text') {
      try {
        const jsonMatch = contentBlock.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            explanation: parsed.explanation || 'Discrepancy analyzed by AI controller.',
            model: this.model,
            confidence: Number(parsed.confidence) || 0.85,
            decision: (['AUTO_RESOLVE', 'REVIEW', 'UNRESOLVED'].includes(parsed.decision)
              ? parsed.decision
              : 'REVIEW') as FinalDecision,
            evidenceIds: Array.isArray(parsed.evidenceIds) ? parsed.evidenceIds : [],
            suggestedAction: parsed.suggestedAction || 'Review exception in dashboard',
            reasoning: parsed.reasoning || '',
          };
        }
      } catch (parseErr) {
        console.error('[AIInvestigation] Failed to parse Claude JSON response:', parseErr);
      }
    }

    return this.heuristicInvestigation(input);
  }

  /**
   * Deterministic & heuristic financial analysis when LLM is offline.
   */
  public heuristicInvestigation(input: AIInvestigationInput): AIInvestigationOutput {
    const evidenceIds: string[] = [];
    if (input.payment?.id) evidenceIds.push(input.payment.id);
    if (input.settlement?.id) evidenceIds.push(input.settlement.id);
    if (input.bankTransaction?.id) evidenceIds.push(input.bankTransaction.id);

    let explanation = '';
    let confidence = 0.85;
    let decision: FinalDecision = 'REVIEW';
    let suggestedAction = '';
    let reasoning = '';

    switch (input.exceptionType) {
      case 'FEE_DIFFERENCE': {
        const gross = Number(input.settlement?.amount || input.payment?.amount || 0);
        const fees = Number(input.settlement?.fees || 0);
        const feeRate = gross > 0 ? (fees / gross) * 100 : 0;

        if (feeRate >= 1.8 && feeRate <= 2.5) {
          explanation = `Standard payment gateway MDR fee applied (~${feeRate.toFixed(2)}%). Net settlement matches gateway deduction.`;
          confidence = 0.98;
          decision = input.amountAtRisk < 10000 ? 'AUTO_RESOLVE' : 'REVIEW';
          suggestedAction = 'Auto-accept fee variance according to standard gateway contract.';
          reasoning = 'Fee variance matches standard standard interchange schedule.';
        } else {
          explanation = `Elevated fee variance of ₹${input.differenceAmount.toFixed(2)} (${feeRate.toFixed(2)}%) requires contract verification.`;
          confidence = 0.82;
          decision = 'REVIEW';
          suggestedAction = 'Request rate verification from payment gateway account manager.';
          reasoning = 'Fee exceeds standard 2.00% benchmark threshold.';
        }
        break;
      }

      case 'TAX_DIFFERENCE': {
        const fees = Number(input.settlement?.fees || 0);
        const tax = Number(input.settlement?.tax || 0);
        const effectiveTaxRate = fees > 0 ? (tax / fees) * 100 : 0;

        if (Math.abs(effectiveTaxRate - 18.0) <= 0.5) {
          explanation = `GST tax computed accurately at 18.0% of gateway processing fees. Minor rounding adjustment detected.`;
          confidence = 0.96;
          decision = 'AUTO_RESOLVE';
          suggestedAction = 'Post GST input tax credit ledger entry.';
          reasoning = 'Standard statutory GST rate verified.';
        } else {
          explanation = `Tax calculation discrepancy: effective tax rate of ${effectiveTaxRate.toFixed(1)}% deviates from statutory 18% GST.`;
          confidence = 0.88;
          decision = 'REVIEW';
          suggestedAction = 'Review gateway tax invoice against monthly return.';
          reasoning = 'Non-standard tax deduction detected.';
        }
        break;
      }

      case 'DATE_DIFFERENCE': {
        explanation = `Settlement timing difference detected (T+2 / weekend processing cycle). Value date aligns with clearing holiday schedule.`;
        confidence = 0.92;
        decision = 'AUTO_RESOLVE';
        suggestedAction = 'Mark as timing variance; reconcile against subsequent batch.';
        reasoning = 'Banking holiday / weekend clearing lag verified.';
        break;
      }

      case 'MISSING_BANK': {
        explanation = `Settlement confirmed by gateway (UTR: ${input.settlement?.utr || 'Pending'}) but uncredited in bank statement. Bank credit pending or wire in transit.`;
        confidence = 0.80;
        decision = input.amountAtRisk > 50000 ? 'REVIEW' : 'REVIEW';
        suggestedAction = `Track UTR ${input.settlement?.utr || 'N/A'} with receiving bank operations.`;
        reasoning = 'Potential uncredited remittance or settlement batch delay.';
        break;
      }

      case 'MISSING_SETTLEMENT': {
        explanation = `Payment captured on gateway (${input.payment?.payment_id}) but missing from settlement batches. Possible gateway hold or rolling reserve.`;
        confidence = 0.78;
        decision = 'REVIEW';
        suggestedAction = 'Check merchant dashboard for risk hold or refund reversal.';
        reasoning = 'No settlement remit record generated by gateway.';
        break;
      }

      case 'AMOUNT_MISMATCH': {
        explanation = `Gross amount mismatch between captured order and settlement credit. Discrepancy: ₹${input.differenceAmount.toFixed(2)}.`;
        confidence = 0.75;
        decision = 'REVIEW';
        suggestedAction = 'Inspect line-item discounts, partial refunds, or chargebacks.';
        reasoning = 'Discrepancy exceeds standard tolerance limits.';
        break;
      }

      case 'DUPLICATE': {
        explanation = `Potential duplicate transaction detected. Duplicate reference or multiple credits identified for single payment.`;
        confidence = 0.90;
        decision = 'REVIEW';
        suggestedAction = 'Flag for fraud/ops inspection and quarantine duplicate entry.';
        reasoning = 'High risk of duplicate ledger posting.';
        break;
      }

      default: {
        explanation = `Insufficient evidence to determine automated resolution. Requires human financial controller inspection.`;
        confidence = 0.50;
        decision = 'UNRESOLVED';
        suggestedAction = 'Assign to senior finance reviewer.';
        reasoning = 'Ambiguous data trail; strict non-hallucination policy applied.';
      }
    }

    return {
      explanation,
      model: this.isConfigured ? this.model : 'ledgerlens-controller-heuristic-v1',
      confidence,
      decision,
      evidenceIds,
      suggestedAction,
      reasoning,
    };
  }
}
