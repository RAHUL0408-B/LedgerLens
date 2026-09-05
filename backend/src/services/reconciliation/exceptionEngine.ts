/**
 * LedgerLens — Exception Engine
 *
 * Categorizes reconciliation discrepancies into structured exceptions.
 * Computes severity, urgency priority (1-100), and financial exposure (amount at risk).
 */

import {
  DeterministicMatchResult,
  ExceptionType,
  SeverityLevel,
} from '../../types/reconciliation';

export interface StructuredException {
  reconciliationResult: DeterministicMatchResult;
  exceptionType: ExceptionType;
  severity: SeverityLevel;
  priority: number; // 1 (urgent) to 100 (low)
  amountAtRisk: number;
  initialReason: string;
}

export class ExceptionEngine {
  private lowRiskThreshold: number;
  private highRiskThreshold: number;

  constructor() {
    this.lowRiskThreshold = Number(process.env.POLICY_LOW_RISK_AMOUNT || 10000);
    this.highRiskThreshold = Number(process.env.POLICY_HIGH_RISK_AMOUNT || 100000);
  }

  /**
   * Evaluates unmatched or discrepant results and creates structured exceptions.
   */
  public processExceptions(results: DeterministicMatchResult[]): StructuredException[] {
    const exceptions: StructuredException[] = [];

    for (const result of results) {
      if (result.status === 'matched') continue;

      const exceptionType = this.classifyExceptionType(result);
      const amountAtRisk = this.calculateAmountAtRisk(result, exceptionType);
      const severity = this.determineSeverity(amountAtRisk, exceptionType);
      const priority = this.calculatePriority(severity, amountAtRisk);

      exceptions.push({
        reconciliationResult: result,
        exceptionType,
        severity,
        priority,
        amountAtRisk,
        initialReason: result.reason || `Exception detected: ${exceptionType}`,
      });
    }

    return exceptions;
  }

  private classifyExceptionType(result: DeterministicMatchResult): ExceptionType {
    if (result.exceptionType) return result.exceptionType;

    const { payment, settlement, bankTransaction } = result;

    if (payment && !settlement) {
      return 'MISSING_SETTLEMENT';
    }

    if (settlement && !bankTransaction) {
      return 'MISSING_BANK';
    }

    if (settlement) {
      const gross = Number(settlement.amount);
      const fees = Number(settlement.fees);
      const tax = Number(settlement.tax);
      const net = Number(settlement.net_amount);

      // Check tax discrepancy (e.g. GST is usually 18% of fees in India)
      if (fees > 0) {
        const expectedTax = Math.round(fees * 0.18 * 100) / 100;
        if (Math.abs(tax - expectedTax) > 0.05 && tax > 0) {
          return 'TAX_DIFFERENCE';
        }
      }

      // Check fee discrepancy
      const expectedNet = gross - fees - tax;
      if (Math.abs(net - expectedNet) > 0.05) {
        return 'FEE_DIFFERENCE';
      }
    }

    if (payment && settlement) {
      const pDate = new Date(payment.payment_date).getTime();
      const sDate = new Date(settlement.settlement_date).getTime();
      const days = Math.abs(sDate - pDate) / (1000 * 60 * 60 * 24);
      if (days > 3) {
        return 'DATE_DIFFERENCE';
      }
    }

    return 'UNKNOWN';
  }

  private calculateAmountAtRisk(result: DeterministicMatchResult, type: ExceptionType): number {
    if (type === 'MISSING_SETTLEMENT' && result.payment) {
      return Number(result.payment.amount);
    }
    if (type === 'MISSING_BANK' && result.settlement) {
      return Number(result.settlement.net_amount);
    }
    if (result.differenceAmount > 0) {
      return result.differenceAmount;
    }
    if (result.payment) {
      return Number(result.payment.amount);
    }
    return 0;
  }

  private determineSeverity(amountAtRisk: number, type: ExceptionType): SeverityLevel {
    if (type === 'DUPLICATE' || amountAtRisk >= this.highRiskThreshold) {
      return 'CRITICAL';
    }
    if (amountAtRisk >= this.lowRiskThreshold || type === 'MISSING_BANK') {
      return 'HIGH';
    }
    if (amountAtRisk > 1000 || type === 'MISSING_SETTLEMENT') {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private calculatePriority(severity: SeverityLevel, amountAtRisk: number): number {
    let baseScore = 50;
    switch (severity) {
      case 'CRITICAL':
        baseScore = 10;
        break;
      case 'HIGH':
        baseScore = 25;
        break;
      case 'MEDIUM':
        baseScore = 50;
        break;
      case 'LOW':
        baseScore = 80;
        break;
    }

    // Adjust by amount at risk (larger amounts = lower number = higher urgency)
    const amountAdjustment = Math.min(10, Math.floor(amountAtRisk / 5000));
    return Math.max(1, Math.min(100, baseScore - amountAdjustment));
  }
}
