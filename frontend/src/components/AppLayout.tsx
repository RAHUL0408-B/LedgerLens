import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  GitMerge,
  AlertTriangle,
  FileBarChart,
  History,
  Settings,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/import', label: 'Data Import', icon: UploadCloud },
  { to: '/reconciliation', label: 'Reconcile', icon: GitMerge },
  { to: '/exceptions', label: 'Exceptions Queue', icon: AlertTriangle },
  { to: '/reports', label: 'Reports & Analytics', icon: FileBarChart },
  { to: '/audit-logs', label: 'Audit Trail', icon: History },
  { to: '/settings', label: 'Policy Settings', icon: Settings },
];

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 antialiased font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/90 flex flex-col flex-shrink-0">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white tracking-tight text-base flex items-center gap-1.5">
              LedgerLens
              <span className="text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-semibold">AI Ops</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">AI Finance Controller</div>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Engine Status Pill */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50">
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Engine Mode</span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Active
              </span>
            </div>
            <div className="text-[11px] text-slate-400 leading-tight">
              Deterministic 1st &bull; AI 2nd
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/40 px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-100 capitalize">
              {navItems.find((n) => location.pathname.startsWith(n.to))?.label || 'Overview'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Merchant: <strong className="text-white">demo_merchant</strong></span>
            </div>
          </div>
        </header>

        {/* Scrollable Page Outlet */}
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
