import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiDownloadCsv, apiRequest, qs } from '../lib/api';
import { formatInr, relativeTime } from '../lib/format';
import {
  Button,
  Card,
  Drawer,
  ErrorText,
  Input,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  Table,
  Tabs,
} from '../components/ui';

type Booking = {
  id: string;
  bookingId: string;
  service: string;
  patientName: string;
  providerName: string;
  scheduledAt: string;
  amount: number;
  status: string;
  paymentStatus: string;
};

type Detail = Booking & {
  patientPhone: string | null;
  pickup?: string | null;
  timeline: { key: string; label: string; at: string | null; state: string }[];
  payment: { amount: number; status: string };
};

type Page = { items: Booking[]; total: number; page: number; totalPages: number; limit: number };

export function BookingsPage() {
  const qc = useQueryClient();
  const [service, setService] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState('7d');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['ops-bookings', service, q, status, range, page],
    queryFn: () =>
      apiRequest<Page>(`/admin/bookings${qs({ service: service || undefined, q, status, range, page, limit: 10 })}`),
  });

  const detail = useQuery({
    queryKey: ['ops-booking', selected],
    queryFn: () => apiRequest<Detail>(`/admin/bookings/${selected}`),
    enabled: Boolean(selected),
  });

  const cancel = useMutation({
    mutationFn: () =>
      apiRequest(`/admin/bookings/${selected}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled by ops console' }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ops-bookings'] });
      void qc.invalidateQueries({ queryKey: ['ops-booking', selected] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const data = list.data;

  return (
    <div>
      <PageHeader
        eyebrow="Operations / Bookings"
        title="Bookings"
        subtitle="Every booking across doctor, diagnostic, pharmacy, ambulance and caretaker services."
        action={
          <Button
            variant="ghost"
            onClick={() =>
              void apiDownloadCsv(
                `/admin/bookings/export${qs({ service: service || undefined, q, status, range })}`,
                'bookings.csv',
              )
            }
          >
            Export
          </Button>
        }
      />
      <div className="mb-4">
        <Tabs
          value={service || 'all'}
          onChange={(id) => {
            setService(id === 'all' ? '' : id);
            setPage(1);
          }}
          items={[
            { id: 'all', label: 'All' },
            { id: 'doctor', label: 'Doctor' },
            { id: 'diagnostics', label: 'Diagnostics' },
            { id: 'pharmacy', label: 'Pharmacy' },
            { id: 'ambulance', label: 'Ambulance' },
            { id: 'caretaker', label: 'Caretaker' },
          ]}
        />
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search by booking ID or patient name"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="max-w-xs"
        />
        <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="max-w-[180px]">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="en_route">En route</option>
        </Select>
        <Select value={range} onChange={(e) => { setPage(1); setRange(e.target.value); }} className="max-w-[160px]">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </Select>
      </div>
      <Table headers={['Booking ID', 'Patient', 'Service', 'Provider assigned', 'Date & time', 'Amount', 'Status', '']}>
        {(data?.items ?? []).map((row) => (
          <tr key={`${row.service}-${row.id}`}>
            <td className="px-4 py-3 font-medium">{row.bookingId}</td>
            <td className="px-4 py-3">{row.patientName}</td>
            <td className="px-4 py-3 capitalize">{row.service}</td>
            <td className="px-4 py-3">{row.providerName}</td>
            <td className="px-4 py-3">{relativeTime(row.scheduledAt)}</td>
            <td className="px-4 py-3">{formatInr(row.amount)}</td>
            <td className="px-4 py-3">
              <StatusPill status={row.status.replace('_', ' ')} />
            </td>
            <td className="px-4 py-3">
              <button type="button" className="text-[var(--brand)] text-sm" onClick={() => setSelected(row.id)}>
                View
              </button>
            </td>
          </tr>
        ))}
      </Table>
      {data ? (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={setPage} />
      ) : null}

      <Drawer
        open={Boolean(selected)}
        title={detail.data ? detail.data.bookingId : 'Booking'}
        onClose={() => {
          setSelected(null);
          setError('');
        }}
      >
        {detail.data ? (
          <div className="space-y-5">
            <ol className="space-y-3">
              {detail.data.timeline.map((step) => (
                <li key={step.key} className="flex gap-3">
                  <span
                    className={`mt-1 size-2.5 rounded-full ${
                      step.state === 'done'
                        ? 'bg-[var(--brand)]'
                        : step.state === 'current'
                          ? 'bg-[#f79009]'
                          : 'bg-[#d0d5dd]'
                    }`}
                  />
                  <div>
                    <div className="text-sm font-medium">{step.label}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {step.at ? relativeTime(step.at) : step.state}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <Card className="space-y-1 text-sm">
              <div className="font-medium">{detail.data.patientName}</div>
              <div className="text-[var(--muted)]">{detail.data.patientPhone ?? 'Phone hidden'}</div>
              {detail.data.pickup ? <div>{detail.data.pickup}</div> : null}
            </Card>
            <Card className="text-sm">
              <div>Amount {formatInr(detail.data.payment.amount)}</div>
              <div className="text-[var(--muted)]">Payment {detail.data.payment.status}</div>
            </Card>
            <ErrorText>{error}</ErrorText>
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                Cancel booking
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        )}
      </Drawer>
    </div>
  );
}
