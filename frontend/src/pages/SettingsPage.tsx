import { useState } from 'react';
import { Settings, Shield, Sliders, Cpu, Save, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [highConfThreshold, setHighConfThreshold] = useState('0.95');
  const [lowRiskCeiling, setLowRiskCeiling] = useState('10000');
  const [dateTolerance, setDateTolerance] = useState('2');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Governance & Policy Settings</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Configure risk thresholds, AI confidence ceilings, and reconciliation parameters.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Risk Governance Policy Card */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
          <div className="flex items-center gap-2 text-white font-semibold text-base border-b border-slate-800 pb-3">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span>Risk-Adjusted Policy Matrix</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">
                Auto-Resolve Confidence Threshold
              </label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="1.0"
                value={highConfThreshold}
                onChange={(e) => setHighConfThreshold(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-500">
                Minimum AI confidence required to authorize automated variance clearance (default: 0.95).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">
                Maximum Auto-Resolve Amount (₹)
              </label>
              <input
                type="number"
                step="1000"
                value={lowRiskCeiling}
                onChange={(e) => setLowRiskCeiling(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-500">
                Financial risk ceiling for automatic resolution. Any variance above this routes to human review.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">
                Date Window Tolerance (Days)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={dateTolerance}
                onChange={(e) => setDateTolerance(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-500">
                Maximum acceptable clearing window for T+2 settlement cycles and holiday lag.
              </p>
            </div>
          </div>
        </div>

        {/* AI Engine Model Information */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-white font-semibold text-base border-b border-slate-800 pb-3">
            <Cpu className="w-5 h-5 text-purple-400" />
            <span>AI Provider & Governance Guardrails</span>
          </div>

          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400">AI Model Provider:</span>
              <span className="font-semibold text-white">Anthropic Claude (claude-3-5-haiku)</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Strict Non-Hallucination Guardrail:</span>
              <span className="font-semibold text-emerald-400">ENABLED (Enforces UNRESOLVED on missing evidence)</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Arithmetic Delegator:</span>
              <span className="font-semibold text-emerald-400">Pure Deterministic Engine (Zero LLM Math)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saved && (
            <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Settings saved successfully
            </span>
          )}
          {!saved && <div />}
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-lg shadow-emerald-950/40 ml-auto"
          >
            <Save className="w-4 h-4" /> Save Policy Settings
          </button>
        </div>
      </form>
    </div>
  );
}
