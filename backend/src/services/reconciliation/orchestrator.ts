/**
 * LedgerLens — Reconciliation Orchestrator
 *
 * Coordinates the full end-to-end reconciliation lifecycle:
 * Data Loading -> Deterministic Engine -> Exception Engine -> AI Investigation -> Policy Engine -> Storage -> Audit
 */

import { supabase } from '../../lib/supabase';
import { DeterministicReconciliationEngine } from './deterministicEngine';
import { ExceptionEngine } from './exceptionEngine';
import { AIInvestigationService } from '../ai/aiInvestigationService';
import { PolicyEngine } from '../policy/policyEngine';
import { AuditService } from '../audit/auditService';
import {
  PaymentRecord,
  SettlementRecord,
  BankTransactionRecord,
} from '../../types/reconciliation';

export interface RunReconciliationOptions {
  merchantId?: string;
  maxAiInvestigations?: number; // limit AI calls per run for rate-limiting safety
}

export class ReconciliationOrchestrator {
  private deterministicEngine: DeterministicReconciliationEngine;
  private exceptionEngine: ExceptionEngine;
  private aiService: AIInvestigationService;
  private policyEngine: PolicyEngine;

  constructor() {
    this.deterministicEngine = new DeterministicReconciliationEngine();
    this.exceptionEngine = new ExceptionEngine();
    this.aiService = new AIInvestigationService();
    this.policyEngine = new PolicyEngine();
  }

  /**
   * Execute a complete reconciliation job.
   */
  public async run(options?: RunReconciliationOptions) {
    const merchantId = options?.merchantId || 'demo_merchant';
    const startTime = Date.now();

    // 1. Create run record
    const { data: run, error: runError } = await supabase
      .from('reconciliation_runs')
      .insert({
        merchant_id: merchantId,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (runError || !run) {
      throw new Error(`Failed to create reconciliation run: ${runError?.message}`);
    }

    const runId = run.id;

    await AuditService.log({
      action: 'RECONCILIATION_STARTED',
      entityType: 'run',
      entityId: runId,
      reason: `Started reconciliation run ${runId} for merchant ${merchantId}`,
    });

    try {
      // 2. Fetch data from Supabase
      const [paymentsRes, settlementsRes, bankRes] = await Promise.all([
        supabase.from('payments').select('*').eq('merchant_id', merchantId),
        supabase.from('settlements').select('*').eq('merchant_id', merchantId),
        supabase.from('bank_transactions').select('*').eq('merchant_id', merchantId),
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      if (settlementsRes.error) throw settlementsRes.error;
      if (bankRes.error) throw bankRes.error;

      const payments = (paymentsRes.data || []) as unknown as PaymentRecord[];
      const settlements = (settlementsRes.data || []) as unknown as SettlementRecord[];
      const bankTransactions = (bankRes.data || []) as unknown as BankTransactionRecord[];

      if (payments.length === 0) {
        // No records to reconcile
        await supabase
          .from('reconciliation_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            total_records: 0,
            matched_records: 0,
            match_rate: 1.0,
            resolution_rate: 1.0,
            processing_time_ms: Date.now() - startTime,
          })
          .eq('id', runId);

        return {
          runId,
          total: 0,
          matched: 0,
          exceptions: 0,
          autoResolved: 0,
          review: 0,
          unresolved: 0,
          matchRate: 1.0,
          resolutionRate: 1.0,
        };
      }

      // 3. Run Deterministic Reconciliation
      const matchResults = this.deterministicEngine.reconcile(
        payments,
        settlements,
        bankTransactions
      );

      // 4. Batch persist reconciliation_results
      const resultRows = matchResults.map((m) => ({
        run_id: runId,
        payment_id: m.payment.id,
        settlement_id: m.settlement?.id || null,
        bank_transaction_id: m.bankTransaction?.id || null,
        status: m.status,
        confidence_score: m.confidenceScore,
        difference_amount: m.differenceAmount,
        exception_type: m.exceptionType || null,
        reason: m.reason,
        matching_rule: m.matchingRule || null,
        resolution_method: m.status === 'matched' ? 'deterministic' : null,
      }));

      const { data: savedResults, error: resultsError } = await supabase
        .from('reconciliation_results')
        .insert(resultRows)
        .select('id, payment_id, status, exception_type, difference_amount');

      if (resultsError) {
        console.error('[Orchestrator] Error saving results:', resultsError);
      }

      // Map saved results back to match objects for foreign key linking
      const resultMap = new Map<string, string>();
      if (savedResults) {
        for (const sr of savedResults) {
          if (sr.payment_id) {
            resultMap.set(sr.payment_id, sr.id);
          }
        }
      }

      // 5. Process Exceptions with Exception Engine
      const structuredExceptions = this.exceptionEngine.processExceptions(matchResults);

      let autoResolvedCount = 0;
      let reviewCount = 0;
      let unresolvedCount = 0;

      const exceptionInsertions = [];

      // 6. AI Investigation & Policy Application
      for (const exc of structuredExceptions) {
        const resultId = resultMap.get(exc.reconciliationResult.payment.id);
        if (!resultId) continue;

        // Investigate with AI
        const aiOutput = await this.aiService.investigate({
          exceptionType: exc.exceptionType,
          differenceAmount: exc.reconciliationResult.differenceAmount,
          amountAtRisk: exc.amountAtRisk,
          payment: exc.reconciliationResult.payment,
          settlement: exc.reconciliationResult.settlement,
          bankTransaction: exc.reconciliationResult.bankTransaction,
        });

        // Apply Governance Policy
        const policyOutput = this.policyEngine.evaluate(
          aiOutput,
          exc.exceptionType,
          exc.amountAtRisk
        );

        let status = 'open';
        if (policyOutput.finalDecision === 'AUTO_RESOLVE') {
          status = 'auto_resolved';
          autoResolvedCount++;
        } else if (policyOutput.finalDecision === 'REVIEW') {
          status = 'review';
          reviewCount++;
        } else {
          status = 'unresolved';
          unresolvedCount++;
        }

        exceptionInsertions.push({
          reconciliation_result_id: resultId,
          severity: exc.severity,
          priority: exc.priority,
          amount_at_risk: exc.amountAtRisk,
          exception_type: exc.exceptionType,
          ai_explanation: aiOutput.explanation,
          ai_model: aiOutput.model,
          ai_confidence: aiOutput.confidence,
          ai_decision: aiOutput.decision,
          ai_evidence_ids: aiOutput.evidenceIds,
          ai_investigated_at: new Date().toISOString(),
          policy_rule_applied: policyOutput.ruleApplied,
          final_decision: policyOutput.finalDecision,
          status,
          resolution_reason: policyOutput.notes,
        });
      }

      // Batch insert exceptions
      if (exceptionInsertions.length > 0) {
        const { error: excInsertError } = await supabase
          .from('exceptions')
          .insert(exceptionInsertions);

        if (excInsertError) {
          console.error('[Orchestrator] Error inserting exceptions:', excInsertError);
        }
      }

      // 7. Update Run Metrics
      const totalRecords = payments.length;
      const matchedRecords = matchResults.filter((m) => m.status === 'matched').length;
      const matchRate = totalRecords > 0 ? matchedRecords / totalRecords : 0;
      const resolutionRate = totalRecords > 0 ? (matchedRecords + autoResolvedCount) / totalRecords : 0;
      const processingTime = Date.now() - startTime;

      await supabase
        .from('reconciliation_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_records: totalRecords,
          matched_records: matchedRecords,
          ai_resolved_records: autoResolvedCount,
          review_records: reviewCount,
          unresolved_records: unresolvedCount,
          match_rate: Math.round(matchRate * 10000) / 10000,
          resolution_rate: Math.round(resolutionRate * 10000) / 10000,
          processing_time_ms: processingTime,
        })
        .eq('id', runId);

      await AuditService.log({
        action: 'RECONCILIATION_COMPLETED',
        entityType: 'run',
        entityId: runId,
        reason: `Completed run ${runId}: ${matchedRecords}/${totalRecords} matched, ${autoResolvedCount} auto-resolved, ${reviewCount} in review`,
      });

      return {
        runId,
        total: totalRecords,
        matched: matchedRecords,
        exceptions: structuredExceptions.length,
        autoResolved: autoResolvedCount,
        review: reviewCount,
        unresolved: unresolvedCount,
        matchRate,
        resolutionRate,
        processingTimeMs: processingTime,
      };
    } catch (err: any) {
      console.error('[Orchestrator] Reconciliation job failed:', err);
      await supabase
        .from('reconciliation_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          processing_time_ms: Date.now() - startTime,
        })
        .eq('id', runId);

      await AuditService.log({
        action: 'RECONCILIATION_FAILED',
        entityType: 'run',
        entityId: runId,
        reason: `Reconciliation failed: ${err?.message || 'Internal error'}`,
      });

      throw err;
    }
  }
}
