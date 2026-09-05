import { useQuery } from '@tanstack/react-query';
import {
  FileBarChart,
  Download,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const COLORS = ['#10B981', '#38BDF8', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function ReportsPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['report-metrics'],
    queryFn: async () => {
      const res = await apiClient.get('/api/reports/summary');
      return res.data?.data;
    },
  });

  const handleExportCsv = () => {
    window.open('/api/reports/export', '_blank');
  };

  const typeData = Object.entries(metrics?.breakdowns?.byType || {}).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    count: value,
  }));

  const severityData = Object.entries(metrics?.breakdowns?.bySeverity || {}).map(([name, value]) => ({
    name,
    count: value,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Financial Reports & Analytics</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Audit-ready reconciliation exports, variance summaries, and financial exposure.
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/40"
        >
          <Download className="w-4 h-4" />
          Export Audit-Ready CSV
        </button>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Match Efficiency
          </div>
          <div className="mt-3 text-3xl font-bold text-white">
            {isLoading ? '...' : `${((metrics?.matchRate || 0) * 100).toFixed(1)}%`}
          </div>
          <div className="text-xs text-slate-400 mt-1">Deterministic straight-through processing</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" /> Financial Exposure at Risk
          </div>
          <div className="mt-3 text-3xl font-bold text-amber-400">
            ₹{isLoading ? '...' : (metrics?.exceptions?.totalAmountAtRisk || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">Total open discrepancy exposure</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-purple-400" /> Auto-Resolved Volume
          </div>
          <div className="mt-3 text-3xl font-bold text-purple-400">
            {isLoading ? '...' : (metrics?.exceptions?.autoResolved || 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1">Cleared under low-risk governance thresholds</div>
        </div>
      </div>

      {/* Analytics Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exception Frequency by Type */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <h3 className="text-base font-semibold text-white">Discrepancy Breakdown by Category</h3>
          <div className="h-72">
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData}>
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No exceptions data available
              </div>
            )}
          </div>
        </div>

        {/* Severity Distribution */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <h3 className="text-base font-semibold text-white">Severity Risk Distribution</h3>
          <div className="h-72 flex items-center justify-center">
            {severityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="count"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {severityData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500">No severity metrics available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
