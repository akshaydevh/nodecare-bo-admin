import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { IconLifebuoy } from '../components/icons';
import {
  Button,
  Card,
  DetailRow,
  Drawer,
  EmptyState,
  ErrorText,
  FieldLabel,
  PageHeader,
  Pagination,
  Select,
  SkeletonRows,
  StatusPill,
  Table,
  TableMessage,
  Tabs,
} from '../components/ui';
import { apiRequest, apiRequestWithMeta, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDateTime, relativeTime } from '../lib/format';
import { can } from '../lib/roles';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type Priority = 'low' | 'normal' | 'high';

type Ticket = {
  id: string;
  ticketId: string;
  userId: string;
  category: 'booking' | 'payment' | 'medical' | 'account' | 'other';
  subject: string;
  message: string;
  status: TicketStatus;
  priority: Priority;
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const HEADERS = ['Ticket', 'Subject', 'Category', 'Priority', 'Status', 'Opened', ''];

function TicketDrawer({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canWrite = can(user?.role, 'bookings');
  const [status, setStatus] = useState<TicketStatus>(ticket?.status ?? 'open');
  const [priority, setPriority] = useState<Priority>(ticket?.priority ?? 'normal');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const update = useMutation({
    mutationFn: () =>
      apiRequest<Ticket>(`/admin/support/tickets/${ticket!.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, priority }),
      }),
    onSuccess: () => {
      setError('');
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const dirty = ticket ? status !== ticket.status || priority !== ticket.priority : false;

  return (
    <Drawer
      open={Boolean(ticket)}
      title={ticket?.subject ?? 'Ticket'}
      subtitle={ticket ? `${ticket.ticketId} · ${ticket.category}` : undefined}
      onClose={onClose}
      size="lg"
    >
      {ticket ? (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <StatusPill status={ticket.status} label={STATUS_LABEL[ticket.status]} />
            <StatusPill status={ticket.priority} label={`${ticket.priority} priority`} />
          </div>
          <Card className="p-4!">
            <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--muted)] mb-1">
              Message from patient
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
          </Card>
          <Card className="p-4! divide-y divide-[var(--line)]">
            <DetailRow label="Opened">{formatDateTime(ticket.createdAt)}</DetailRow>
            <DetailRow label="Last update">{formatDateTime(ticket.updatedAt)}</DetailRow>
            {ticket.resolvedAt ? <DetailRow label="Resolved">{formatDateTime(ticket.resolvedAt)}</DetailRow> : null}
            <DetailRow label="User ID">
              <span className="font-mono text-xs">{ticket.userId}</span>
            </DetailRow>
          </Card>

          {canWrite ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setSaved(false);
                update.mutate();
              }}
            >
              <div className="text-[15px] font-semibold">Update ticket</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="ticket-status">Status</FieldLabel>
                  <Select
                    id="ticket-status"
                    value={status}
                    onChange={(e) => {
                      setSaved(false);
                      setStatus(e.target.value as TicketStatus);
                    }}
                  >
                    {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel htmlFor="ticket-priority">Priority</FieldLabel>
                  <Select
                    id="ticket-priority"
                    value={priority}
                    onChange={(e) => {
                      setSaved(false);
                      setPriority(e.target.value as Priority);
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-[var(--muted)]">
                The patient gets a notification with the new status. Replies are handled outside the console for now.
              </p>
              <ErrorText>{error}</ErrorText>
              {saved ? (
                <p className="text-sm text-[#067647]" role="status">
                  Ticket updated and assigned to you.
                </p>
              ) : null}
              <Button type="submit" disabled={!dirty || update.isPending}>
                {update.isPending ? 'Saving…' : 'Save'}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

export function SupportTicketsPage() {
  const [status, setStatus] = useState<TicketStatus | ''>('open');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['support-tickets', status, page],
    queryFn: () => apiRequestWithMeta<Ticket[]>(`/admin/support/tickets${qs({ status, page, limit: 20 })}`),
    placeholderData: keepPreviousData,
  });
  const items = list.data?.data ?? [];
  const meta = list.data?.meta;
  const selected = items.find((t) => t.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Operations / Support"
        title="Support tickets"
        subtitle="Requests raised from Help & Support in the patient app. Set a status to keep the patient informed."
      />
      <div className="mb-4">
        <Tabs
          value={status || 'all'}
          onChange={(id) => {
            setStatus(id === 'all' ? '' : (id as TicketStatus));
            setPage(1);
          }}
          items={[
            { id: 'open', label: 'Open' },
            { id: 'in_progress', label: 'In progress' },
            { id: 'resolved', label: 'Resolved' },
            { id: 'closed', label: 'Closed' },
            { id: 'all', label: 'All' },
          ]}
        />
      </div>
      {list.isError ? <ErrorText>{(list.error as Error).message}</ErrorText> : null}
      <Table headers={HEADERS}>
        {list.isLoading ? (
          <TableMessage colSpan={HEADERS.length}>
            <SkeletonRows rows={5} className="h-10" />
          </TableMessage>
        ) : list.data && items.length === 0 ? (
          <TableMessage colSpan={HEADERS.length}>
            <EmptyState
              icon={<IconLifebuoy className="size-5" />}
              title={status === 'open' ? 'No open tickets' : 'No tickets here'}
              body="Tickets raised from the app appear here."
            />
          </TableMessage>
        ) : (
          items.map((t) => (
            <tr
              key={t.id}
              className={`cursor-pointer ${selectedId === t.id ? 'bg-[var(--brand-soft)]' : 'hover:bg-[#f8fafb]'}`}
              onClick={() => setSelectedId(t.id)}
            >
              <td className="px-4 py-3 font-medium whitespace-nowrap">{t.ticketId}</td>
              <td className="px-4 py-3 max-w-[320px]">
                <div className="font-medium truncate">{t.subject}</div>
                <div className="text-xs text-[var(--muted)] truncate">{t.message}</div>
              </td>
              <td className="px-4 py-3 capitalize">{t.category}</td>
              <td className="px-4 py-3">
                <StatusPill status={t.priority} />
              </td>
              <td className="px-4 py-3">
                <StatusPill status={t.status} label={STATUS_LABEL[t.status]} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]" title={formatDateTime(t.createdAt)}>
                {relativeTime(t.createdAt)}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  className="text-[var(--brand)] text-sm"
                  aria-label={`Open ticket ${t.ticketId}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(t.id);
                  }}
                >
                  Open
                </button>
              </td>
            </tr>
          ))
        )}
      </Table>
      {meta && meta.total > 0 ? (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPage={setPage} />
      ) : null}
      <TicketDrawer key={selected?.id ?? 'none'} ticket={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
