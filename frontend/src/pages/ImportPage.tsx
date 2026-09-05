import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Database,
  ArrowRight,
  Sparkles,
  GitMerge,
  ShieldCheck,
  RotateCcw,
  Check,
  Layers,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { Link, useNavigate } from 'react-router-dom';

export default function ImportPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // 3 file states
  const [paymentsFile, setPaymentsFile] = useState<File | null>(null);
  const [settlementsFile, setSettlementsFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);

  // Result state
  const [batchResult, setBatchResult] = useState<any>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Reset Data Mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/import/reset');
      return res.data;
    },
    onSuccess: (data) => {
      setPaymentsFile(null);
      setSettlementsFile(null);
      setBankFile(null);
      setBatchResult(null);
      setResetMessage(data.message || 'All data wiped successfully!');
      setTimeout(() => setResetMessage(null), 5000);
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-runs'] });
      queryClient.invalidateQueries({ queryKey: ['exceptions-list'] });
    },
  });

  // Upload All 3 Files & Reconcile in 1-Click
  const batchUploadMutation = useMutation({
    mutationFn: async ({ autoReconcile }: { autoReconcile: boolean }) => {
      const formData = new FormData();
      if (paymentsFile) formData.append('payments', paymentsFile);
      if (settlementsFile) formData.append('settlements', settlementsFile);
      if (bankFile) formData.append('bank_transactions', bankFile);

      const res = await apiClient.post(
        `/api/import/all?reconcile=${autoReconcile ? 'true' : 'false'}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      return res.data;
    },
    onSuccess: (data) => {
      setBatchResult(data);
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-runs'] });
      queryClient.invalidateQueries({ queryKey: ['exceptions-list'] });
    },
  });

  // 1-Click Demo Dataset (Instant Ingest & Compare)
  const demoMutation = useMutation({
    mutationFn: async () => {
      // 1. Import demo files
      const importRes = await apiClient.post('/api/import/demo');
      // 2. Trigger reconciliation immediately
      const reconRes = await apiClient.post('/api/reconciliation/run', {
        merchantId: 'demo_merchant',
      });
      return {
        ...importRes.data,
        reconciliation: reconRes.data?.data,
      };
    },
    onSuccess: (data) => {
      setBatchResult(data);
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-runs'] });
      queryClient.invalidateQueries({ queryKey: ['exceptions-list'] });
    },
  });

  const allFilesSelected = paymentsFile && settlementsFile && bankFile;
  const anyFileSelected = paymentsFile || settlementsFile || bankFile;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">3-Way Data Ingestion & Comparison</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Upload Payments, Gateway Settlements, and Bank Transactions simultaneously for instant reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Reset button */}
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all transactions, reconciliation runs, and exceptions?')) {
                resetMutation.mutate();
              }
            }}
            disabled={resetMutation.isPending}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-rose-500/30 text-rose-400 hover:bg-rose-950/30 text-xs font-semibold transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {resetMutation.isPending ? 'Clearing Data...' : 'Reset All Data'}
          </button>

          {/* 1-Click Full Demo Button */}
          <button
            onClick={() => demoMutation.mutate()}
            disabled={demoMutation.isPending || batchUploadMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/50 flex-shrink-0"
          >
            {demoMutation.isPending ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                Ingesting & Comparing Demo Data...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Load Demo Dataset
              </>
            )}
          </button>
        </div>
      </div>

      {/* Reset Confirmation Banner */}
      {resetMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>{resetMessage}</span>
        </div>
      )}


      {/* 3-File Dropzone Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Payments File */}
        <div className={`p-5 rounded-2xl border transition relative ${
          paymentsFile
            ? 'bg-blue-950/20 border-blue-500/50 shadow-sm'
            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> 1. Payments CSV
            </span>
            {paymentsFile && <Check className="w-4 h-4 text-emerald-400" />}
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Customer payment orders captured on gateway (Gross Amount).
          </p>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-xl p-4 cursor-pointer bg-slate-950/60 transition">
            <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
            <span className="text-xs font-semibold text-slate-200 text-center truncate max-w-[200px]">
              {paymentsFile ? paymentsFile.name : 'Select payments.csv'}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">Click or drag file</span>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && setPaymentsFile(e.target.files[0])}
              className="hidden"
            />
          </label>
        </div>

        {/* 2. Settlements File */}
        <div className={`p-5 rounded-2xl border transition relative ${
          settlementsFile
            ? 'bg-purple-950/20 border-purple-500/50 shadow-sm'
            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> 2. Settlements CSV
            </span>
            {settlementsFile && <Check className="w-4 h-4 text-emerald-400" />}
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Gateway payout batches with MDR fees, GST tax, and net payout.
          </p>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-purple-500/60 rounded-xl p-4 cursor-pointer bg-slate-950/60 transition">
            <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
            <span className="text-xs font-semibold text-slate-200 text-center truncate max-w-[200px]">
              {settlementsFile ? settlementsFile.name : 'Select settlements.csv'}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">Click or drag file</span>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && setSettlementsFile(e.target.files[0])}
              className="hidden"
            />
          </label>
        </div>

        {/* 3. Bank Transactions File */}
        <div className={`p-5 rounded-2xl border transition relative ${
          bankFile
            ? 'bg-emerald-950/20 border-emerald-500/50 shadow-sm'
            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> 3. Bank Statement CSV
            </span>
            {bankFile && <Check className="w-4 h-4 text-emerald-400" />}
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Bank account ledger statement with NEFT/RTGS/IMPS wire credits.
          </p>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl p-4 cursor-pointer bg-slate-950/60 transition">
            <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
            <span className="text-xs font-semibold text-slate-200 text-center truncate max-w-[200px]">
              {bankFile ? bankFile.name : 'Select bank_transactions.csv'}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">Click or drag file</span>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && setBankFile(e.target.files[0])}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Batch Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="text-xs text-slate-300">
          Selected files:{' '}
          <strong className="text-white">
            {[paymentsFile && 'Payments', settlementsFile && 'Settlements', bankFile && 'Bank Transactions']
              .filter(Boolean)
              .join(', ') || 'None selected'}
          </strong>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            disabled={!anyFileSelected || batchUploadMutation.isPending}
            onClick={() => batchUploadMutation.mutate({ autoReconcile: false })}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold text-xs transition"
          >
            {batchUploadMutation.isPending ? 'Uploading...' : 'Import Files Only'}
          </button>
          <button
            type="button"
            disabled={!anyFileSelected || batchUploadMutation.isPending}
            onClick={() => batchUploadMutation.mutate({ autoReconcile: true })}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/40"
          >
            <GitMerge className="w-4 h-4" />
            {batchUploadMutation.isPending ? 'Uploading & Comparing...' : 'Upload & Compare All (1-Click)'}
          </button>
        </div>
      </div>

      {/* FINAL ANSWER / RECONCILIATION RESULT BANNER */}
      {batchResult && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/40 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Final 3-Way Reconciliation Results</h3>
                <p className="text-xs text-slate-400">
                  Total Records Ingested: <strong className="text-white">{batchResult.totalImported || '1,000+'}</strong>
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Completed
            </span>
          </div>

          {/* Breakdown cards */}
          {batchResult.reconciliation && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-xs text-slate-400 font-medium">Exact Matches</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {batchResult.reconciliation.matched}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {((batchResult.reconciliation.matched / (batchResult.reconciliation.total || 1)) * 100).toFixed(1)}% match rate
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-xs text-slate-400 font-medium">AI Auto-Resolved</div>
                <div className="text-2xl font-bold text-purple-400 mt-1">
                  {batchResult.reconciliation.autoResolved}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Safe risk clearance</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-xs text-slate-400 font-medium">Human Review Required</div>
                <div className="text-2xl font-bold text-amber-400 mt-1">
                  {batchResult.reconciliation.review}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Needs controller review</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-xs text-slate-400 font-medium">Unresolved (Guarded)</div>
                <div className="text-2xl font-bold text-rose-400 mt-1">
                  {batchResult.reconciliation.unresolved}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Refused to hallucinate</div>
              </div>
            </div>
          )}

          {/* Direct CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <span className="text-xs text-slate-300">
              Discrepancies investigated with Claude AI Financial Controller.
            </span>
            <button
              onClick={() => navigate('/exceptions')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/40"
            >
              Open Exceptions Queue & Investigate <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
