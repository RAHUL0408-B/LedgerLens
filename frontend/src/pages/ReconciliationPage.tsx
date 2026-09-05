import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GitMerge,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { Link } from 'react-router-dom';

const PIPELINE_STEPS = [
  'Data Loading & Ingestion Verification',
  'Multi-Pass Deterministic Matching (Rules 1-4)',
  'Exception Detection & Risk Classification',
  'AI Root-Cause Investigation',
  'Governance & Risk-Adjusted Policy Engine',
  'Ledger Update & Immutable Audit Logging',
];

export default function ReconciliationPage() {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [lastRunResult, setLastRunResult] = useState<any>(null);

  const { data: runs, isLoading } = useQuery({
    queryKey: ['reconciliation-runs'],
    queryFn: async () => {
      const res = await apiClient.get('/api/reconciliation/runs?limit=10');
      return res.data?.data || [];
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      // Simulate visual progress step through pipeline
      setActiveStep(0);
      const timer = setInterval(() => {
        setActiveStep((prev) => (prev < PIPELINE_STEPS.length - 1 ? prev + 1 : prev));
      }, 400);

      try {
        const res = await apiClient.post('/api/reconciliation/run', {
          merchantId: 'demo_merchant',
        });
        clearInterval(timer);
        setActiveStep(PIPELINE_STEPS.length);
        return res.data?.data;
      } catch (err) {
        clearInterval(timer);
        setActiveStep(-1);
        throw err;
      }
    },
    onSuccess: (data) => {
      setLastRunResult(data);
      queryClient.invalidateQueries({ queryKey: ['reconciliation-runs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['exceptions-list'] });
    },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Reconciliation Engine</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Deterministic matching first. AI exception governance second.
          </p>
        </div>
        <button
          onClick={() => reconcileMutation.mutate()}
          disabled={reconcileMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm transition shadow-lg shadow-emerald-950/40"
        >
          {reconcileMutation.isPending ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              Reconciling Ledgers...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              Execute 3-Way Reconciliation
            </>
          )}
        </button>
      </div>

      {/* Pipeline Step Progress Tracker */}
      {reconcileMutation.isPending && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Live Execution Pipeline
          </h3>
          <div className="space-y-2.5">
            {PIPELINE_STEPS.map((step, idx) => {
              const isDone = activeStep > idx;
              const isCurrent = activeStep === idx;
              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 p-3 rounded-lg text-xs font-medium transition ${
                    isDone
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : isCurrent
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                      : 'bg-slate-950/60 text-slate-500 border border-slate-800/60'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                    {isDone ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <span>{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Last Run Results Card */}
      {lastRunResult && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-500/30 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
              <CheckCircle2 className="w-5 h-5" />
              <span>Reconciliation Run Completed</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Run ID: {lastRunResult.runId}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs text-slate-400">Total Examined</div>
              <div className="text-2xl font-bold text-white mt-1">
                {lastRunResult.total.toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs text-slate-400">Deterministic Matches</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {lastRunResult.matched.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {((lastRunResult.matched / (lastRunResult.total || 1)) * 100).toFixed(1)}% exact match
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs text-slate-400">AI Auto-Resolved</div>
              <div className="text-2xl font-bold text-purple-400 mt-1">
                {lastRunResult.autoResolved.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Safe risk threshold</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs text-slate-400">Human Review</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                {lastRunResult.review.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Needs controller review</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs text-slate-400">Processing Time</div>
              <div className="text-2xl font-bold text-slate-200 mt-1">
                {lastRunResult.processingTimeMs}ms
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Sub-second engine</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              to="/exceptions"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
            >
              Open Exceptions Queue ({lastRunResult.review}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* History of Past Runs */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h3 className="text-base font-semibold text-white">Reconciliation Execution History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Run ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Exact Match</th>
                <th className="px-4 py-3">Auto-Resolved</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(runs || []).map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-800/30 transition text-xs">
                  <td className="px-4 py-3 font-mono text-slate-300">{r.id.substring(0, 8)}...</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{r.total_records}</td>
                  <td className="px-4 py-3 text-emerald-400 font-medium">{r.matched_records}</td>
                  <td className="px-4 py-3 text-purple-400 font-medium">{r.ai_resolved_records || 0}</td>
                  <td className="px-4 py-3 text-amber-400 font-medium">{r.review_records || 0}</td>
                  <td className="px-4 py-3 text-slate-400">{r.processing_time_ms ? `${r.processing_time_ms}ms` : '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(r.started_at).toLocaleString()}</td>
                </tr>
              ))}
              {(!runs || runs.length === 0) && (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-slate-500 text-xs">
                    {isLoading ? 'Loading run history...' : 'No runs recorded yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
