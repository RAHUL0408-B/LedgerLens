/**
 * Login page — full implementation in Phase 21 (Authentication).
 * Placeholder to keep the app compilable during Phase 1.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted">
      <div className="bg-white border border-surface-border rounded-lg p-10 w-full max-w-sm text-center">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-ink">LedgerLens</h1>
          <p className="text-sm text-ink-tertiary mt-1">AI Finance Controller</p>
        </div>
        <p className="text-xs text-ink-disabled">
          Authentication will be implemented in Phase 21.
        </p>
        <a
          href="/dashboard"
          className="btn-primary mt-6 w-full justify-center"
        >
          Continue to Dashboard →
        </a>
      </div>
    </div>
  );
}
