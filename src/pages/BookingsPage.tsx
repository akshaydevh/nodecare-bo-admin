import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { IconCalendar } from '../components/icons';
import {
  Button,
  EmptyState,
  ErrorText,
  Input,
  PageHeader,
  Pagination,
  Select,
  SkeletonRows,
  StatusPill,
  Table,
  TableMessage,
  Tabs,
} from '../components/ui';
import { apiDownloadCsv, apiRequest, qs } from '../lib/api';
import { formatDateTime, formatInr, relativeTime } from '../lib/format';
import { BookingDetailDrawer } from './bookings/BookingDetailDrawer';
import {
  bookingStatusLabel,
  bookingStatusTone,
  paymentStatusLabel,
  statusGroupsFor,
  type BookingService,
} from './bookings/booking-status';

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

type Page = { items: Booking[]; total: number; page: number; totalPages: number; limit: number };

const HEADERS = ['Booking ID', 'Patient', 'Service', 'Provider', 'Date & time', 'Amount', 'Status', ''];

export function BookingsPage() {
  const [service, setService] = useState<BookingService | ''>('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState('7d');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [exportError, setExportError] = useState('');

  const list = useQuery({
    queryKey: ['ops-bookings', service, q, status, range, page],
    queryFn: () =>
      apiRequest<Page>(`/admin/bookings${qs({ service: service || undefined, q, status, range, page, limit: 10 })}`),
  });

  const data = list.data;
  const statusGroups = statusGroupsFor(service);

  return (
    <div>
      <PageHeader
        eyebrow="Operations / Bookings"
        title="Bookings"
        subtitle="Every booking across doctor, diagnostic, pharmacy, ambulance and caretaker services. Visits start as requests and wait for the provider to accept."
        action={
          <Button
            variant="ghost"
            onClick={() => {
              setExportError('');
              apiDownloadCsv(
                `/admin/bookings/export${qs({ service: service || undefined, q, status, range })}`,
                'bookings.csv',
              ).catch((err: Error) => setExportError(err.message));
            }}
          >
            Export
          </Button>
        }
      />
      <ErrorText>{exportError}</ErrorText>
      <div className="mb-4">
        <Tabs
          value={service || 'all'}
          onChange={(id) => {
            const next = id === 'all' ? '' : (id as BookingService);
            setService(next);
            // Keep the status filter only if it still applies to the new service.
            if (status && !statusGroupsFor(next).some((g) => g.options.some((o) => o.value === status))) {
              setStatus('');
            }
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
          aria-label="Search bookings"
          placeholder="Search by booking ID or patient name"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="max-w-xs"
        />
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="max-w-[220px]"
        >
          <option value="">All statuses</option>
          {statusGroups.length === 1
            ? statusGroups[0]!.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            : statusGroups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => (
                    <option key={`${g.label}-${o.value}`} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
        </Select>
        <Select
          aria-label="Date range"
          value={range}
          onChange={(e) => {
            setPage(1);
            setRange(e.target.value);
          }}
          className="max-w-[160px]"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </Select>
      </div>
      {list.isError ? <ErrorText>{(list.error as Error).message}</ErrorText> : null}
      <Table headers={HEADERS}>
        {list.isLoading ? (
          <TableMessage colSpan={HEADERS.length}>
            <SkeletonRows rows={6} className="h-10" />
          </TableMessage>
        ) : data && data.items.length === 0 ? (
          <TableMessage colSpan={HEADERS.length}>
            <EmptyState
              icon={<IconCalendar className="size-5" />}
              title="No bookings match these filters"
              body="Try a wider date range or clear the status filter."
            />
          </TableMessage>
        ) : (
          (data?.items ?? []).map((row) => (
            <tr
              key={`${row.service}-${row.id}`}
              className={`cursor-pointer ${selected === row.id ? 'bg-[var(--brand-soft)]' : 'hover:bg-[#f8fafb]'}`}
              onClick={() => setSelected(row.id)}
            >
              <td className="px-4 py-3 font-medium whitespace-nowrap">{row.bookingId}</td>
              <td className="px-4 py-3">{row.patientName}</td>
              <td className="px-4 py-3 capitalize">{row.service}</td>
              <td className="px-4 py-3">{row.providerName}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div>{formatDateTime(row.scheduledAt)}</div>
                <div className="text-xs text-[var(--muted)]">{relativeTime(row.scheduledAt)}</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div>{formatInr(row.amount)}</div>
                <div className="text-xs text-[var(--muted)] capitalize">{paymentStatusLabel(row.paymentStatus)}</div>
              </td>
              <td className="px-4 py-3">
                <StatusPill
                  status={bookingStatusTone(row.service, row.status)}
                  label={bookingStatusLabel(row.service, row.status)}
                />
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  className="text-[var(--brand)] text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(row.id);
                  }}
                  aria-label={`View booking ${row.bookingId}`}
                >
                  View
                </button>
              </td>
            </tr>
          ))
        )}
      </Table>
      {data && data.total > 0 ? (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={setPage} />
      ) : null}

      <BookingDetailDrawer bookingId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
