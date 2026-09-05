import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  ShieldCheck,
  UserCheck,
  RotateCcw,
  UploadCloud,
  FileText,
  Filter,
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';

export default function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState<string>('');

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['audit-logs', actionFilter],
    queryFn: async () => {
      let url = '/api/audit-logs?limit=50';
      if (actionFilter) url += `&action=${actionFilter}`;
      const res = await apiClient.get(url);
      return res.data;
    },
  });

  const logs = logsData?.data || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Audit Trail & Governance Log</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Immutable financial activity log for compliance and operational transparency.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Event Actions</option>
            <option value="RECONCILIATION_COMPLETED">Reconciliation Completed</option>
            <option value="MANUAL_RESOLUTION">Manual Resolution</option>
            <option value="AUTO_RESOLUTION">Auto Resolution</option>
            <option value="IMPORT_COMPLETED">Import Completed</option>
          </select>
        </div>
      </div>

      {/* Audit Log Timeline */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-sm">
        <div className="divide-y divide-slate-800/60 text-xs">
          {logs.map((log: any) => (
            <div key={log.id} className="p-4 hover:bg-slate-800/20 transition flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                {log.action.includes('MANUAL') ? (
                  <UserCheck className="w-4 h-4 text-purple-400" />
                ) : log.action.includes('IMPORT') ? (
                  <UploadCloud className="w-4 h-4 text-blue-400" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                )}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-300 text-xs">
                  {log.reason || `Action recorded on entity ${log.entity_type}:${log.entity_id}`}
                </p>
                <div className="text-[11px] text-slate-500 font-mono">
                  Entity: {log.entity_type} &bull; ID: {log.entity_id} &bull; Operator: {log.user_id || 'System Autonomous'}
                </div>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="text-center py-10 text-slate-500">
              {isLoading ? 'Loading audit records...' : 'No audit events found.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
