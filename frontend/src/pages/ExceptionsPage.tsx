import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  ShieldCheck,
  Eye,
  Check,
  X,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';

export default function ExceptionsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [selectedException, setSelectedException] = useState<any>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');

  const { data: exceptionsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['exceptions-list', statusFilter, severityFilter],
    queryFn: async () => {
      let url = '/api/exceptions?limit=50';
      if (statusFilter) url += `&status=${statusFilter}`;
      if (severityFilter) url += `&severity=${severityFilter}`;
      const res = await apiClient.get(url);
      return res.data;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: string; reason: string }) => {
      const res = await apiClient.post(`/api/exceptions/${id}/resolve`, {
        action,
        reason,
        assignedTo: 'controller_admin',
      });
      return res.data;
    },
    onSuccess: () => {
      setSelectedException(null);
      setResolutionNote('');
      queryClient.invalidateQueries({ queryKey: ['exceptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
  });

  const exceptions = exceptionsData?.data || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Exceptions & Investigations</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            AI-investigated discrepancies with controller review controls.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white transition self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {/* Filter Tabs & Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        {/* Status filters */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'All Exceptions', value: '' },
            { label: 'Review Required', value: 'review' },
            { label: 'Auto-Resolved', value: 'auto_resolved' },
            { label: 'Open', value: 'open' },
            { label: 'Resolved', value: 'resolved' },
            { label: 'Unresolved', value: 'unresolved' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === tab.value
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Severity filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Exceptions Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Severity</th>
                <th className="px-5 py-3.5">Exception Type</th>
                <th className="px-5 py-3.5">Amount at Risk</th>
                <th className="px-5 py-3.5">AI Confidence</th>
                <th className="px-5 py-3.5">Governance Decision</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {exceptions.map((exc: any) => {
                const conf = exc.ai_confidence ? (exc.ai_confidence * 100).toFixed(0) : '—';
                return (
                  <tr key={exc.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        exc.severity === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : exc.severity === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : exc.severity === 'MEDIUM'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-slate-700/30 text-slate-300 border border-slate-700/50'
                      }`}>
                        {exc.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-200">
                      {exc.exception_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-100">
                      ₹{Number(exc.amount_at_risk).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                          <div
                            className={`h-full ${
                              Number(exc.ai_confidence) >= 0.9
                                ? 'bg-emerald-400'
                                : Number(exc.ai_confidence) >= 0.75
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                            }`}
                            style={{ width: `${conf}%` }}
                          />
                        </div>
                        <span className="font-mono text-slate-300 text-[11px]">{conf}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 font-semibold ${
                        exc.final_decision === 'AUTO_RESOLVE'
                          ? 'text-emerald-400'
                          : exc.final_decision === 'REVIEW'
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}>
                        {exc.final_decision === 'AUTO_RESOLVE' && <ShieldCheck className="w-3.5 h-3.5" />}
                        {exc.final_decision || 'PENDING'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                        exc.status === 'auto_resolved' || exc.status === 'resolved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : exc.status === 'review'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {exc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedException(exc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        Investigate
                      </button>
                    </td>
                  </tr>
                );
              })}

              {exceptions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    {isLoading ? 'Loading exceptions queue...' : 'No exceptions matching current filter criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investigation Detail Modal */}
      {selectedException && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                    {selectedException.exception_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">ID: {selectedException.id}</span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">Exception Investigation Dossier</h3>
              </div>
              <button
                onClick={() => setSelectedException(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Explanation & Root Cause */}
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> AI Controller Root Cause
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  Model: {selectedException.ai_model || 'claude-3-5-haiku'}
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                {selectedException.ai_explanation || 'No AI explanation recorded.'}
              </p>
              <div className="flex items-center gap-4 text-xs pt-1 text-slate-400">
                <span>Confidence: <strong className="text-white">{((selectedException.ai_confidence || 0) * 100).toFixed(1)}%</strong></span>
                <span>Policy Applied: <strong className="text-emerald-400">{selectedException.policy_rule_applied || 'Standard'}</strong></span>
              </div>
            </div>

            {/* 3-Way Match Data Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Payment card */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="font-semibold text-blue-400 border-b border-slate-800 pb-1">Payment (Gateway)</div>
                {selectedException.reconciliation_results?.payments ? (
                  <div className="space-y-1 text-slate-300">
                    <div>ID: <strong className="text-white font-mono">{selectedException.reconciliation_results.payments.payment_id}</strong></div>
                    <div>Gross: <strong className="text-white">₹{selectedException.reconciliation_results.payments.amount}</strong></div>
                    <div>Date: <span className="text-slate-400">{selectedException.reconciliation_results.payments.payment_date}</span></div>
                    <div>Method: <span className="capitalize">{selectedException.reconciliation_results.payments.payment_method || 'N/A'}</span></div>
                  </div>
                ) : (
                  <div className="text-slate-500 italic">No payment record attached</div>
                )}
              </div>

              {/* Settlement card */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="font-semibold text-purple-400 border-b border-slate-800 pb-1">Settlement Remit</div>
                {selectedException.reconciliation_results?.settlements ? (
                  <div className="space-y-1 text-slate-300">
                    <div>ID: <strong className="text-white font-mono">{selectedException.reconciliation_results.settlements.settlement_id}</strong></div>
                    <div>Net: <strong className="text-white">₹{selectedException.reconciliation_results.settlements.net_amount}</strong></div>
                    <div>Fees/Tax: ₹{selectedException.reconciliation_results.settlements.fees} + ₹{selectedException.reconciliation_results.settlements.tax}</div>
                    <div>UTR: <span className="font-mono text-slate-400">{selectedException.reconciliation_results.settlements.utr || 'Pending'}</span></div>
                  </div>
                ) : (
                  <div className="text-slate-500 italic">No settlement record found</div>
                )}
              </div>

              {/* Bank transaction card */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="font-semibold text-emerald-400 border-b border-slate-800 pb-1">Bank Statement Credit</div>
                {selectedException.reconciliation_results?.bank_transactions ? (
                  <div className="space-y-1 text-slate-300">
                    <div>Ref: <strong className="text-white font-mono">{selectedException.reconciliation_results.bank_transactions.bank_reference}</strong></div>
                    <div>Credit: <strong className="text-white">₹{selectedException.reconciliation_results.bank_transactions.amount}</strong></div>
                    <div>Date: <span className="text-slate-400">{selectedException.reconciliation_results.bank_transactions.transaction_date}</span></div>
                    <div>UTR: <span className="font-mono text-slate-400">{selectedException.reconciliation_results.bank_transactions.utr || 'N/A'}</span></div>
                  </div>
                ) : (
                  <div className="text-slate-500 italic">No bank credit record found</div>
                )}
              </div>
            </div>

            {/* Human Resolution Controls */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <label className="block text-xs font-semibold text-slate-200">
                Controller Sign-Off & Resolution Notes
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Enter rationale for resolution or escalation..."
                rows={2}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() =>
                    resolveMutation.mutate({
                      id: selectedException.id,
                      action: 'REJECT',
                      reason: resolutionNote || 'Escalated / Marked as Unresolved by controller',
                    })
                  }
                  disabled={resolveMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600/30 text-xs font-semibold transition"
                >
                  Escalate as Unresolved
                </button>
                <button
                  onClick={() =>
                    resolveMutation.mutate({
                      id: selectedException.id,
                      action: 'ACCEPT',
                      reason: resolutionNote || 'Manual approval confirmed by controller',
                    })
                  }
                  disabled={resolveMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-lg shadow-emerald-950/40"
                >
                  Approve & Resolve Exception
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
