/**
 * LedgerLens — Deterministic Reconciliation Engine
 *
 * Principle: Deterministic reconciliation first. AI investigation second.
 * The AI should never be responsible for basic arithmetic or exact matching.
 *
 * Rules:
 *   RULE_1: Exact Reference Match (payment_id / transaction ID match + amounts match)
 *   RULE_2: UTR Match (settlement.utr == bank_transaction.utr && settlement.net_amount == bank.amount)
 *   RULE_3: Date Window & Exact Amount Match (payment date to settlement date within window, amounts match)
 *   RULE_4: Fee & Tax Arithmetic Match (gross - fees - tax == net_amount == bank_amount)
 *
 * Output:
 *   - Matched records (status: 'matched', resolution_method: 'deterministic')
 *   - Exception candidates (status: 'exception' | 'missing_bank' | 'missing_settlement' | 'duplicate')
 */

import {
  PaymentRecord,
  SettlementRecord,
  BankTransactionRecord,
  DeterministicMatchResult,
  ExceptionType,
} from '../../types/reconciliation';

export interface DeterministicEngineOptions {
  dateToleranceDays?: number;
  amountTolerance?: number; // small rounding tolerance (e.g. 0.01)
}

export class DeterministicReconciliationEngine {
  private dateToleranceDays: number;
  private amountTolerance: number;

  constructor(options?: DeterministicEngineOptions) {
    this.dateToleranceDays = options?.dateToleranceDays ?? Number(process.env.POLICY_DATE_TOLERANCE_DAYS || 2);
    this.amountTolerance = options?.amountTolerance ?? 0.02;
  }

  /**
   * Run multi-pass deterministic matching against active payments, settlements, and bank transactions.
   */
  public reconcile(
    payments: PaymentRecord[],
    settlements: SettlementRecord[],
    bankTransactions: BankTransactionRecord[]
  ): DeterministicMatchResult[] {
    const results: DeterministicMatchResult[] = [];

    // Track used settlement and bank transaction IDs to prevent duplicate matching
    const matchedSettlementIds = new Set<string>();
    const matchedBankTxIds = new Set<string>();

    // Pre-index settlements and bank transactions for O(1) lookups
    const settlementByPaymentRef = new Map<string, SettlementRecord[]>();
    const settlementByUtr = new Map<string, SettlementRecord[]>();
    const settlementsList: SettlementRecord[] = [];

    for (const s of settlements) {
      settlementsList.push(s);
      if (s.utr) {
        const utrKey = s.utr.trim().toUpperCase();
        const existing = settlementByUtr.get(utrKey) || [];
        existing.push(s);
        settlementByUtr.set(utrKey, existing);
      }
      // Check metadata for payment_ids or related references
      if (s.metadata?.payment_id && typeof s.metadata.payment_id === 'string') {
        const pid = s.metadata.payment_id.trim();
        const existing = settlementByPaymentRef.get(pid) || [];
        existing.push(s);
        settlementByPaymentRef.set(pid, existing);
      }
    }

    const bankByUtr = new Map<string, BankTransactionRecord[]>();
    const bankList: BankTransactionRecord[] = [];

    for (const b of bankTransactions) {
      bankList.push(b);
      if (b.utr) {
        const utrKey = b.utr.trim().toUpperCase();
        const existing = bankByUtr.get(utrKey) || [];
        existing.push(b);
        bankByUtr.set(utrKey, existing);
      }
    }

    // Process each payment
    for (const payment of payments) {
      const grossAmount = Number(payment.amount);
      const paymentDate = new Date(payment.payment_date).getTime();

      // Find candidates for this payment
      let matchedSettlement: SettlementRecord | null = null;
      let matchedBank: BankTransactionRecord | null = null;
      let matchedRule: string | null = null;
      let exceptionType: ExceptionType | null = null;
      let differenceAmount = 0;
      let matchReason = '';

      // ─── PASS 1: Direct Reference Match ─────────────────────────────────
      const refMatches = settlementByPaymentRef.get(payment.payment_id.trim());
      if (refMatches && refMatches.length > 0) {
        const candidate = refMatches.find((s) => !matchedSettlementIds.has(s.id));
        if (candidate) {
          matchedSettlement = candidate;
          matchedRule = 'RULE_1_EXACT_REFERENCE';
        }
      }

      // ─── PASS 2: Exact Amount + Fee/Tax Arithmetic Match ────────────────
      if (!matchedSettlement) {
        for (const s of settlementsList) {
          if (matchedSettlementIds.has(s.id)) continue;

          const sDate = new Date(s.settlement_date).getTime();
          const dayDiff = Math.abs(sDate - paymentDate) / (1000 * 60 * 60 * 24);

          if (dayDiff <= this.dateToleranceDays + 3) {
            const expectedNet = Number(s.amount) - Number(s.fees) - Number(s.tax);
            const netDiff = Math.abs(Number(s.net_amount) - expectedNet);
            const amountDiff = Math.abs(Number(s.amount) - grossAmount);

            if (amountDiff <= this.amountTolerance && netDiff <= this.amountTolerance) {
              matchedSettlement = s;
              matchedRule = 'RULE_4_FEE_TAX_ARITHMETIC';
              break;
            }
          }
        }
      }

      // ─── PASS 3: Date Window + Approximate Match ────────────────────────
      if (!matchedSettlement) {
        for (const s of settlementsList) {
          if (matchedSettlementIds.has(s.id)) continue;

          const sDate = new Date(s.settlement_date).getTime();
          const dayDiff = Math.abs(sDate - paymentDate) / (1000 * 60 * 60 * 24);

          if (dayDiff <= this.dateToleranceDays) {
            const amountDiff = Math.abs(Number(s.amount) - grossAmount);
            if (amountDiff <= this.amountTolerance) {
              matchedSettlement = s;
              matchedRule = 'RULE_3_DATE_WINDOW_AMOUNT';
              break;
            }
          }
        }
      }

      // Now match Settlement with Bank Transaction if settlement found
      if (matchedSettlement) {
        matchedSettlementIds.add(matchedSettlement.id);
        const netSettlement = Number(matchedSettlement.net_amount);

        // 1. Try UTR match
        if (matchedSettlement.utr) {
          const utrKey = matchedSettlement.utr.trim().toUpperCase();
          const bankCandidates = bankByUtr.get(utrKey) || [];
          const bMatch = bankCandidates.find((b) => !matchedBankTxIds.has(b.id));
          if (bMatch) {
            const bAmountDiff = Math.abs(Number(bMatch.amount) - netSettlement);
            if (bAmountDiff <= this.amountTolerance) {
              matchedBank = bMatch;
              matchedBankTxIds.add(bMatch.id);
              if (!matchedRule) matchedRule = 'RULE_2_UTR_BANK_MATCH';
            }
          }
        }

        // 2. Try Bank Amount + Date Match if no UTR match
        if (!matchedBank) {
          const sDate = new Date(matchedSettlement.settlement_date).getTime();
          for (const b of bankList) {
            if (matchedBankTxIds.has(b.id)) continue;
            if (b.transaction_type !== 'credit') continue;

            const bDate = new Date(b.transaction_date).getTime();
            const bDayDiff = Math.abs(bDate - sDate) / (1000 * 60 * 60 * 24);

            if (bDayDiff <= this.dateToleranceDays) {
              const diff = Math.abs(Number(b.amount) - netSettlement);
              if (diff <= this.amountTolerance) {
                matchedBank = b;
                matchedBankTxIds.add(b.id);
                break;
              }
            }
          }
        }
      }

      // ─── EVALUATE 3-WAY MATCH STATUS ──────────────────────────────────
      if (matchedSettlement && matchedBank) {
        // Complete 3-way match
        const expectedNet = Number(matchedSettlement.amount) - Number(matchedSettlement.fees) - Number(matchedSettlement.tax);
        const feeDiscrepancy = Math.abs(Number(matchedSettlement.net_amount) - expectedNet);
        const bankDiscrepancy = Math.abs(Number(matchedBank.amount) - Number(matchedSettlement.net_amount));

        if (feeDiscrepancy <= this.amountTolerance && bankDiscrepancy <= this.amountTolerance) {
          results.push({
            payment,
            settlement: matchedSettlement,
            bankTransaction: matchedBank,
            status: 'matched',
            matchingRule: matchedRule || 'RULE_1_EXACT_REFERENCE',
            confidenceScore: 1.0,
            differenceAmount: 0,
            exceptionType: null,
            reason: '3-way reconciliation verified: payment captured, settlement calculated correctly, bank credit confirmed.',
          });
          continue;
        } else {
          // Discrepancy in fees or bank amount
          differenceAmount = feeDiscrepancy > this.amountTolerance ? feeDiscrepancy : bankDiscrepancy;
          exceptionType = feeDiscrepancy > this.amountTolerance ? 'FEE_DIFFERENCE' : 'AMOUNT_MISMATCH';
          matchReason = `Discrepancy detected: net settlement calculation mismatch of ${differenceAmount.toFixed(2)}`;
        }
      } else if (matchedSettlement && !matchedBank) {
        // Settlement exists but bank credit missing
        differenceAmount = Number(matchedSettlement.net_amount);
        exceptionType = 'MISSING_BANK';
        matchReason = `Settlement ${matchedSettlement.settlement_id} processed for amount ${differenceAmount.toFixed(2)} but no corresponding bank transaction found.`;
      } else if (!matchedSettlement) {
        // Payment captured but no settlement received
        differenceAmount = grossAmount;
        exceptionType = 'MISSING_SETTLEMENT';
        matchReason = `Payment ${payment.payment_id} (${grossAmount.toFixed(2)}) captured but no settlement record found from gateway.`;
      }

      // Record Exception Candidate
      results.push({
        payment,
        settlement: matchedSettlement,
        bankTransaction: matchedBank,
        status: 'exception',
        matchingRule: matchedRule || undefined,
        confidenceScore: 0.0,
        differenceAmount: Math.abs(differenceAmount),
        exceptionType,
        reason: matchReason,
      });
    }

    return results;
  }
}
