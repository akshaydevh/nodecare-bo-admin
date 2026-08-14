import { useAuth } from '../lib/auth';
import { Card, PageHeader } from '../components/ui';

export function SettingsPage() {
  const { user } = useAuth();
  const apiBase = import.meta.env.VITE_API_BASE_URL;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Session and environment details." />
      <Card className="space-y-2 text-sm">
        <div>
          <span className="text-[var(--muted)]">Signed in as </span>
          <strong>{user?.username || user?.email}</strong>
        </div>
        <div>
          <span className="text-[var(--muted)]">Role </span>
          <strong>{user?.role}</strong>
        </div>
        <div>
          <span className="text-[var(--muted)]">API </span>
          <code className="text-xs bg-[var(--brand-soft)] px-1.5 py-0.5 rounded">{apiBase}</code>
        </div>
        <p className="text-[var(--muted)] pt-2">
          Rotate the seeded root password in every shared environment. Keep CORS locked to this BO
          origin.
        </p>
      </Card>
    </div>
  );
}
