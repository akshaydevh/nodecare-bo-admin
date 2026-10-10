import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { IconLifebuoy } from '../components/icons';
import {
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
import { apiRequestWithMeta, qs } from '../lib/api';
import { formatDateTime, relativeTime } from '../lib/format';
import { TicketDrawer } from './support/TicketDrawer';
import { CATEGORY_LABEL, STATUS_LABEL, type Category, type Priority, type Ticket, type TicketStatus } from './support/types';

const HEADERS = ['Ticket', 'Patient', 'Subject', 'Category', 'Priority', 'Status', 'Last activity'];

function lastActivity(t: Ticket) {
  const last = t.replies.at(-1);
  return { at: last?.at ?? t.createdAt, from: last?.from ?? 'patient' };
}

export function SupportTicketsPage() {
  const [status, setStatus] = useState<TicketStatus | ''>('open');
  const [q, setQ] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [category, setCategory] = useState<Category | ''>('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['support-tickets', status, q.trim(), priority, category, page],
    queryFn: () =>
      apiRequestWithMeta<Ticket[]>(
        `/admin/support/tickets${qs({ status, q: q.trim(), priority, category, page, limit: 20 })}`,
      ),
    placeholderData: keepPreviousData,
  });
  const items = list.data?.data ?? [];
  const meta = list.data?.meta;
  const filtered = Boolean(q.trim() || priority || category);

  return (
    <div>
      <PageHeader
        eyebrow="Operations / Support"
        title="Support tickets"
        subtitle="Requests raised from Help & Support in the patient app. Replies reach the patient in the app, by push and by email."
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
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          aria-label="Search tickets"
          placeholder="Search ticket ID, subject or message"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="max-w-xs"
        />
        <Select
          aria-label="Filter by priority"
          value={priority}
          onChange={(e) => {
            setPage(1);
            setPriority(e.target.value as Priority | '');
          }}
          className="max-w-[160px]"
        >
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </Select>
        <Select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => {
            setPage(1);
            setCategory(e.target.value as Category | '');
          }}
          className="max-w-[170px]"
        >
          <option value="">All categories</option>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
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
              title={filtered ? 'No tickets match these filters' : status === 'open' ? 'No open tickets' : 'No tickets here'}
              body={filtered ? 'Try clearing the search or filters.' : 'Tickets raised from the app appear here.'}
            />
          </TableMessage>
        ) : (
          items.map((t) => {
            const last = lastActivity(t);
            return (
              <tr
                key={t.id}
                tabIndex={0}
                aria-label={`Open ticket ${t.ticketId}: ${t.subject}`}
                className={`cursor-pointer ${selectedId === t.id ? 'bg-[var(--brand-soft)]' : 'hover:bg-[#f8fafb]'}`}
                onClick={() => setSelectedId(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedId(t.id);
                  }
                }}
              >
                <td className="px-4 py-3 font-medium whitespace-nowrap">{t.ticketId}</td>
                <td className="px-4 py-3">
                  <div>{t.customer.name ?? '—'}</div>
                  <div className="text-xs text-[var(--muted)] whitespace-nowrap">{t.customer.phone ?? ''}</div>
                </td>
                <td className="px-4 py-3 max-w-[300px]">
                  <div className="font-medium truncate">{t.subject}</div>
                  <div className="text-xs text-[var(--muted)] truncate">{t.replies.at(-1)?.body ?? t.message}</div>
                </td>
                <td className="px-4 py-3">{CATEGORY_LABEL[t.category]}</td>
                <td className="px-4 py-3">
                  <StatusPill status={t.priority} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={t.status} label={STATUS_LABEL[t.status]} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap" title={formatDateTime(last.at)}>
                  <div className="text-[var(--muted)]">{relativeTime(last.at)}</div>
                  <div className={`text-xs ${last.from === 'patient' ? 'text-[#b54708]' : 'text-[var(--muted)]'}`}>
                    {last.from === 'patient' ? 'Waiting on us' : 'Replied'}
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </Table>
      {meta && meta.total > 0 ? (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPage={setPage} />
      ) : null}
      <TicketDrawer
        ticketId={selectedId}
        initial={items.find((t) => t.id === selectedId) ?? null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
