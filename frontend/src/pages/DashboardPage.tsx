import { useQuery } from '@tanstack/react-query';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('API unreachable');
  return res.json() as Promise<HealthResponse>;
}

/**
 * Dashboard page — full implementation in Phase 13.
 * This stub verifies the API health connection is working.
 */
export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: 1,
  });

  return (
    <div className="min-h-screen bg-surface-muted p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-ink">LedgerLens</h1>
          <p className="text-sm text-ink-tertiary mt-1">
            AI Finance Controller — Phase 1 Foundation
          </p>
        </div>

        {/* API Health */}
        <div className="metric-card mb-4">
          <p className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-2">
            Backend API Health
          </p>
          {isLoading && (
            <p className="text-sm text-ink-secondary">Checking API…</p>
          )}
          {error && (
            <p className="text-sm text-status-unresolved">
              ✕ API unreachable — start the backend with{' '}
              <code className="font-mono bg-surface-subtle px-1 rounded">
                npm run dev:backend
              </code>
            </p>
          )}
          {data && (
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-status-matched font-medium">✓ API online</span>
              </p>
              <p className="text-xs text-ink-tertiary font-mono">
                {data.service} · {data.status} · {new Date(data.timestamp).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>

        {/* Phase status */}
        <div className="metric-card">
          <p className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-3">
            Implementation Status
          </p>
          <div className="space-y-2 text-sm">
            {[
              { phase: 1, label: 'Foundation', done: true },
              { phase: 2, label: 'Supabase Database', done: false },
              { phase: 3, label: 'Synthetic Dataset Generator', done: false },
              { phase: 4, label: 'CSV Import Pipeline', done: false },
              { phase: 5, label: 'Deterministic Reconciliation Engine', done: false },
            ].map(({ phase, label, done }) => (
              <div key={phase} className="flex items-center gap-2">
                <span className={done ? 'text-status-matched' : 'text-ink-disabled'}>
                  {done ? '✓' : '○'}
                </span>
                <span className={done ? 'text-ink' : 'text-ink-tertiary'}>
                  Phase {phase}: {label}
                </span>
                {done && (
                  <span className="badge bg-status-matched-bg text-status-matched ml-auto">
                    Complete
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
