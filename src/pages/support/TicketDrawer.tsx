import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Button,
  DetailRow,
  Drawer,
  ErrorText,
  FieldLabel,
  Select,
  SkeletonRows,
  StatusPill,
  Textarea,
} from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateTime, relativeTime } from '../../lib/format';
import { can } from '../../lib/roles';
import { CATEGORY_LABEL, STATUS_LABEL, type Priority, type Ticket, type TicketReply, type TicketStatus } from './types';

const REPLY_MAX = 5000;

function Bubble({ from, author, body, at }: { from: TicketReply['from']; author: string; body: string; at: string }) {
  const support = from === 'support';
  return (
    <li className={`flex ${support ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${support ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            support
              ? 'rounded-br-md bg-[var(--brand)] text-white'
              : 'rounded-bl-md border border-[var(--line)] bg-[#f8fafb] text-[var(--ink)]'
          }`}
        >
          {body}
        </div>
        <div className="mt-1 px-1 text-[11px] text-[var(--muted)]" title={formatDateTime(at)}>
          {author} · {relativeTime(at)}
        </div>
      </div>
    </li>
  );
}

function Conversation({ ticket }: { ticket: Ticket }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [ticket.replies.length]);
  const patient = ticket.customer.name ?? 'Patient';
  return (
    <ol className="space-y-3" aria-label="Conversation">
      <Bubble from="patient" author={patient} body={ticket.message} at={ticket.createdAt} />
      {ticket.replies.map((r, i) => (
        <Bubble key={`${r.at}-${i}`} from={r.from} author={r.from === 'patient' ? patient : r.authorName} body={r.body} at={r.at} />
      ))}
      <li ref={end} aria-hidden />
    </ol>
  );
}

function ReplyBox({ ticket }: { ticket: Ticket }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const reply = useMutation({
    mutationFn: () =>
      apiRequest<Ticket>(`/admin/support/tickets/${ticket.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body: body.trim() }),
      }),
    onSuccess: (updated) => {
      setBody('');
      setError('');
      qc.setQueryData(['support-ticket', ticket.id], updated);
      void qc.invalidateQueries({ queryKey: ['support-tickets'] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (body.trim().length >= 2) reply.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <FieldLabel htmlFor="ticket-reply" hint={`(${body.length}/${REPLY_MAX})`}>
        Reply to {ticket.customer.name ?? 'patient'}
      </FieldLabel>
      <Textarea
        id="ticket-reply"
        value={body}
        maxLength={REPLY_MAX}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit(e);
        }}
        placeholder="Write a reply…"
        className="min-h-[96px]"
      />
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted)]">
          Sent as an in-app, push and email notification.
          {ticket.status === 'open' ? ' Moves the ticket to In progress.' : ''}
        </p>
        <Button type="submit" disabled={reply.isPending || body.trim().length < 2}>
          {reply.isPending ? 'Sending…' : 'Send reply'}
        </Button>
      </div>
    </form>
  );
}

function StatusForm({ ticket }: { ticket: Ticket }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [priority, setPriority] = useState<Priority>(ticket.priority);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Replies can move the status server-side; follow it unless the operator is mid-edit.
  const [synced, setSynced] = useState({ status: ticket.status, priority: ticket.priority });
  if (synced.status !== ticket.status || synced.priority !== ticket.priority) {
    setSynced({ status: ticket.status, priority: ticket.priority });
    setStatus(ticket.status);
    setPriority(ticket.priority);
  }

  const update = useMutation({
    mutationFn: () =>
      apiRequest<Ticket>(`/admin/support/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, priority }),
      }),
    onSuccess: () => {
      setError('');
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['support-ticket', ticket.id] });
      void qc.invalidateQueries({ queryKey: ['support-tickets'] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const dirty = status !== ticket.status || priority !== ticket.priority;

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        update.mutate();
      }}
    >
      <div className="min-w-[140px] flex-1">
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
      <div className="min-w-[120px] flex-1">
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
      <Button type="submit" variant="ghost" disabled={!dirty || update.isPending}>
        {update.isPending ? 'Saving…' : 'Update'}
      </Button>
      <div className="basis-full">
        <ErrorText>{error}</ErrorText>
        {saved ? (
          <p className="text-xs text-[#067647]" role="status">
            Saved. The patient was notified of the new status.
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function TicketDrawer({
  ticketId,
  initial,
  onClose,
}: {
  ticketId: string | null;
  initial: Ticket | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const canWrite = can(user?.role, 'bookings');

  const detail = useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: () => apiRequest<Ticket>(`/admin/support/tickets/${ticketId}`),
    enabled: Boolean(ticketId),
    placeholderData: initial ?? undefined,
  });
  const ticket = detail.data;

  return (
    <Drawer
      open={Boolean(ticketId)}
      title={ticket?.subject ?? 'Ticket'}
      subtitle={ticket ? `${ticket.ticketId} · ${CATEGORY_LABEL[ticket.category]}` : undefined}
      onClose={onClose}
      size="lg"
    >
      {detail.isLoading && !ticket ? <SkeletonRows rows={4} /> : null}
      {detail.isError ? <ErrorText>{(detail.error as Error).message}</ErrorText> : null}
      {ticket ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={ticket.status} label={STATUS_LABEL[ticket.status]} />
            <StatusPill status={ticket.priority} label={`${ticket.priority} priority`} />
          </div>

          <div className="rounded-xl border border-[var(--line)] px-4 divide-y divide-[var(--line)]">
            <DetailRow label="Patient">
              {ticket.customer.name ?? '—'}
              {ticket.customer.phone ? (
                <div className="text-xs font-normal text-[var(--muted)]">{ticket.customer.phone}</div>
              ) : null}
            </DetailRow>
            <DetailRow label="Opened">{formatDateTime(ticket.createdAt)}</DetailRow>
            {ticket.resolvedAt ? <DetailRow label="Resolved">{formatDateTime(ticket.resolvedAt)}</DetailRow> : null}
          </div>

          <Conversation ticket={ticket} />

          {canWrite ? (
            <>
              {ticket.status === 'closed' ? (
                <p className="rounded-lg bg-[#f8fafb] px-3 py-2 text-sm text-[var(--muted)]">
                  This ticket is closed. Reopen it below to keep the conversation going.
                </p>
              ) : (
                <ReplyBox key={ticket.id} ticket={ticket} />
              )}
              <div className="border-t border-[var(--line)] pt-4">
                <StatusForm key={ticket.id} ticket={ticket} />
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">Replying needs a Support, Ops Admin or Super Admin role.</p>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
