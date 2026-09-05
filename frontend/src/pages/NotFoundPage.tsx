export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted">
      <div className="text-center">
        <p className="text-5xl font-mono font-bold text-ink-disabled">404</p>
        <p className="mt-2 text-sm text-ink-secondary">Page not found</p>
        <a href="/dashboard" className="btn-secondary mt-4 inline-flex">
          ← Dashboard
        </a>
      </div>
    </div>
  );
}
