import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';
import { Card, PageHeader } from '../components/ui';

type Overview = {
  totals: Record<string, number>;
  usersByRole: Record<string, number>;
  revenue: Record<string, number>;
};

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => apiRequest<Overview>('/admin/analytics/overview'),
  });

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live platform counters from Mongo aggregations." />
      {isLoading ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}
      {error ? (
        <p className="text-sm text-[var(--danger)]">{(error as Error).message}</p>
      ) : null}
      {data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(data.totals).map(([key, value]) => (
            <Card key={key}>
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{key}</div>
              <div className="text-3xl font-semibold mt-2">{value}</div>
            </Card>
          ))}
          <Card className="md:col-span-2">
            <div className="text-sm font-medium mb-3">Users by role</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(data.usersByRole).map(([role, count]) => (
                <div key={role} className="flex justify-between border-b border-[var(--line)] py-1">
                  <span>{role}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="md:col-span-2">
            <div className="text-sm font-medium mb-3">Revenue shell</div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              {Object.entries(data.revenue).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[var(--muted)]">{k}</div>
                  <div className="text-xl font-semibold">₹{v}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
