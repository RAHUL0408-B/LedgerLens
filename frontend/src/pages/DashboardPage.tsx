import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  GitMerge,
  UploadCloud,
  FileBarChart,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function DashboardPage() {
  const { data: metrics, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const res = await apiClient.get('/api/reports/summary');
      return res.data?.data;
    },
    refetchInterval: 10000,
  });

  const { data: runs } = useQuery({
    queryKey: ['recent-runs'],
    queryFn: async () => {
      const res = await apiClient.get('/api/reconciliation/runs?limit=5');
      return res.data?.data || [];
    },
  });

  const matchRate = metrics?.matchRate ? (metrics.matchRate * 100).toFixed(1) : '0.0';
  const resolutionRate = metrics?.resolutionRate ? (metrics.resolutionRate * 100).toFixed(1) : '0.0';

  const typeData = Object.entries(metrics?.breakdowns?.byType || {}).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
  }));

  const pieData = [
    { name: 'Matched', value: metrics?.latestRun?.matched_records || 0 },
    { name: 'Auto Resolved', value: metrics?.exceptions?.autoResolved || 0 },
    { name: 'Review Needed', value: metrics?.exceptions?.open || 0 },
    { name: 'Unresolved', value: metrics?.exceptions?.unresolved || 0 },
  ].filter((d) => d.value > 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Finance Operations Dashboard</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Automated 3-way payment reconciliation with AI risk governance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh
          </button>
          <Link
            to="/reconciliation"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-950/40"
          >
            <GitMerge className="w-4 h-4" />
            Run Reconciliation
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Payments</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-white">
            {isLoading ? '...' : (metrics?.totalPayments || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <span>Captured from gateway</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Deterministic Match</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-emerald-400">
            {isLoading ? '...' : `${matchRate}%`}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {metrics?.latestRun?.matched_records || 0} records matched exactly
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Auto-Resolution</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-purple-400">
            {isLoading ? '...' : `${resolutionRate}%`}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {metrics?.exceptions?.autoResolved || 0} safe AI auto-resolutions
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Exceptions Queue</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-amber-400">
            {isLoading ? '...' : (metrics?.exceptions?.open || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            ₹{(metrics?.exceptions?.totalAmountAtRisk || 0).toLocaleString('en-IN')} amount at risk
          </div>
        </div>
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Match Breakdown Chart */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
          <h3 className="text-base font-semibold text-white mb-1">Reconciliation Health Breakdown</h3>
          <p className="text-xs text-slate-400 mb-4">Distribution across deterministic matches and exception categories</p>
          <div className="h-64 flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500">Run a reconciliation job to populate breakdown</div>
            )}
          </div>
        </div>

        {/* Exception Types Bar Chart */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
          <h3 className="text-base font-semibold text-white mb-1">Exception Types Distribution</h3>
          <p className="text-xs text-slate-400 mb-4">Frequency of discrepancies classified by the engine</p>
          <div className="h-64">
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" stroke="#64748b" />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#38BDF8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No exceptions detected yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Reconciliation Runs Table */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Recent Reconciliation Runs</h3>
            <p className="text-xs text-slate-400">History of batch reconciliation executions</p>
          </div>
          <Link to="/reconciliation" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Run ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Matched</th>
                <th className="px-4 py-3">Match Rate</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Executed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(runs || []).map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.id.substring(0, 8)}...</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      r.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">{r.total_records}</td>
                  <td className="px-4 py-3 text-emerald-400 font-medium">{r.matched_records}</td>
                  <td className="px-4 py-3 text-slate-200">{((r.match_rate || 0) * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{r.processing_time_ms ? `${r.processing_time_ms}ms` : '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(r.started_at).toLocaleString()}</td>
                </tr>
              ))}
              {(!runs || runs.length === 0) && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-500 text-xs">
                    No runs executed yet. Click "Run Reconciliation" to start.
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
