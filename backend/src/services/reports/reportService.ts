/**
 * LedgerLens — Reporting & Analytics Service
 *
 * Provides aggregated business metrics, reconciliation health stats, and CSV exports.
 */

import { supabase } from '../../lib/supabase';

export class ReportService {
  /**
   * Get high-level summary KPIs for the dashboard.
   */
  public static async getSummaryMetrics(merchantId: string = 'demo_merchant') {
    // 1. Fetch latest run
    const { data: latestRun } = await supabase
      .from('reconciliation_runs')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Fetch aggregate count of payments
    const { count: totalPayments } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId);

    // 3. Fetch aggregate count of exceptions by status
    const { data: exceptions } = await supabase
      .from('exceptions')
      .select('status, severity, amount_at_risk, exception_type, final_decision');

    const allExceptions = exceptions || [];
    const openCount = allExceptions.filter((e) => e.status === 'open' || e.status === 'review').length;
    const autoResolvedCount = allExceptions.filter((e) => e.status === 'auto_resolved').length;
    const unresolvedCount = allExceptions.filter((e) => e.status === 'unresolved').length;
    const manualResolvedCount = allExceptions.filter((e) => e.status === 'resolved').length;

    const totalAmountAtRisk = allExceptions
      .filter((e) => e.status === 'open' || e.status === 'review')
      .reduce((sum, e) => sum + Number(e.amount_at_risk || 0), 0);

    // Exception type breakdown
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const e of allExceptions) {
      byType[e.exception_type] = (byType[e.exception_type] || 0) + 1;
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
    }

    return {
      totalPayments: totalPayments || 0,
      latestRun: latestRun || null,
      matchRate: latestRun ? Number(latestRun.match_rate) : 0,
      resolutionRate: latestRun ? Number(latestRun.resolution_rate) : 0,
      exceptions: {
        total: allExceptions.length,
        open: openCount,
        autoResolved: autoResolvedCount,
        unresolved: unresolvedCount,
        manualResolved: manualResolvedCount,
        totalAmountAtRisk,
      },
      breakdowns: {
        byType,
        bySeverity,
      },
    };
  }

  /**
   * Export reconciliation results as CSV.
   */
  public static async exportResultsCsv(merchantId: string = 'demo_merchant'): Promise<string> {
    const { data: results, error } = await supabase
      .from('reconciliation_results')
      .select(`
        id,
        status,
        confidence_score,
        difference_amount,
        exception_type,
        matching_rule,
        reason,
        created_at,
        payments (payment_id, amount, payment_date, currency),
        settlements (settlement_id, amount, net_amount, utr),
        bank_transactions (bank_reference, amount, transaction_date)
      `)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) throw error;

    const headers = [
      'Result ID',
      'Status',
      'Exception Type',
      'Difference Amount',
      'Confidence Score',
      'Matching Rule',
      'Payment ID',
      'Payment Amount',
      'Payment Date',
      'Settlement ID',
      'Settlement Net',
      'Bank Ref',
      'Reason',
    ];

    const rows = (results || []).map((r: any) => [
      r.id,
      r.status,
      r.exception_type || 'N/A',
      r.difference_amount || '0.00',
      r.confidence_score || '0.00',
      r.matching_rule || 'N/A',
      r.payments?.payment_id || 'N/A',
      r.payments?.amount || 'N/A',
      r.payments?.payment_date || 'N/A',
      r.settlements?.settlement_id || 'N/A',
      r.settlements?.net_amount || 'N/A',
      r.bank_transactions?.bank_reference || 'N/A',
      `"${(r.reason || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}
