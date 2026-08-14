import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';
import { Card, PageHeader } from '../components/ui';

type Overview = {
  appointmentsByStatus: Record<string, number>;
  labBookingsByStatus: Record<string, number>;
  pharmacyOrdersByStatus: Record<string, number>;
  ambulanceByStatus: Record<string, number>;
};

function StatusCard({ title, data }: { title: string; data?: Record<string, number> }) {
  return (
    <Card>
      <div className="text-sm font-medium mb-3">{title}</div>
      <div className="space-y-1 text-sm">
        {Object.entries(data ?? {}).map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-[var(--line)] py-1">
            <span>{k}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
        {!data || Object.keys(data).length === 0 ? (
          <div className="text-[var(--muted)]">No data</div>
        ) : null}
      </div>
    </Card>
  );
}

export function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-detail'],
    queryFn: () => apiRequest<Overview>('/admin/analytics/overview'),
  });

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Status breakdowns across bookings and orders." />
      {isLoading ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}
      <div className="grid md:grid-cols-2 gap-4">
        <StatusCard title="Appointments" data={data?.appointmentsByStatus} />
        <StatusCard title="Lab bookings" data={data?.labBookingsByStatus} />
        <StatusCard title="Pharmacy orders" data={data?.pharmacyOrdersByStatus} />
        <StatusCard title="Ambulance" data={data?.ambulanceByStatus} />
      </div>
    </div>
  );
}
