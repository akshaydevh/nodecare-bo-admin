import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Card,
  ConfirmDialog,
  DetailRow,
  Drawer,
  ErrorText,
  FieldLabel,
  SkeletonRows,
  StatusPill,
  Textarea,
  Button,
} from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateTime, formatInr, relativeFromNow } from '../../lib/format';
import { can } from '../../lib/roles';
import {
  bookingStatusLabel,
  bookingStatusTone,
  isAppointmentService,
  isTerminalStatus,
  paymentModeLabel,
  paymentStatusLabel,
} from './booking-status';

/**
 * Timeline steps from GET /admin/bookings/:id. For doctor/caretaker visits they
 * come from the appointment's status history; other services send their own
 * fulfilment steps (which may use `skipped`).
 */
type ApiStep = {
  key: string;
  label: string;
  at: string | null;
  by?: string | null;
  note?: string | null;
  state: 'done' | 'current' | 'pending' | 'skipped';
};

export type BookingDetail = {
  id: string;
  bookingId: string;
  service: string;
  patientName: string;
  providerName: string;
  scheduledAt: string;
  createdAt?: string | null;
  amount: number;
  status: string;
  paymentStatus: string;
  patientPhone: string | null;
  notes?: string | null;
  pickup?: string | null;
  dropoff?: string | null;
  collectionAddress?: string | null;
  deliveryAddress?: string | null;
  items?: { name?: string; quantity?: number; price?: number }[];
  timeline: ApiStep[];
  payment: { amount: number; status: string; mode?: string | null; channel?: string | null };
  cancelReason?: string | null;
  cancelledBy?: string | null;
  rejectReason?: string | null;
  respondBy?: string | null;
  paymentMode?: string | null;
};

type StepState = ApiStep['state'] | 'failed';

const DOT: Record<StepState, string> = {
  done: 'bg-[var(--brand)]',
  current: 'bg-[#f79009] ring-4 ring-[#fffaeb]',
  pending: 'bg-[#d0d5dd]',
  failed: 'bg-[#f04438]',
  skipped: 'bg-[#d0d5dd]',
};

const NEGATIVE_STEP = /^(rejected|expired|cancelled|no_show)\b/;

/** Display state: negative outcomes (declined, expired, cancelled, no-show) read as failed. */
function stepState(step: ApiStep): StepState {
  return NEGATIVE_STEP.test(step.key) ? 'failed' : step.state;
}

function byLabel(by: string | null | undefined) {
  if (!by) return null;
  if (by === 'system') return 'NOD Care';
  return by.charAt(0).toUpperCase() + by.slice(1);
}

function stepTime(step: ApiStep, state: StepState) {
  if (!step.at) return state === 'current' ? 'In progress' : null;
  if (state === 'current' && step.key === 'awaiting') {
    return `Respond by ${formatDateTime(step.at)} (${relativeFromNow(step.at)}), or the request expires`;
  }
  if (state === 'pending') return `Scheduled ${formatDateTime(step.at)}`;
  const who = byLabel(step.by);
  return `${formatDateTime(step.at)}${who ? ` · ${who}` : ''}`;
}

function Timeline({ d }: { d: BookingDetail }) {
  const steps = [...d.timeline];
  // Non-visit services do not record a cancellation step themselves.
  if (!isAppointmentService(d.service) && d.status === 'cancelled' && !steps.some((s) => s.key.startsWith('cancelled'))) {
    steps.push({ key: 'cancelled', label: 'Cancelled', at: null, state: 'done', note: d.cancelReason });
  }
  return (
    <ol className="relative space-y-4" aria-label="Booking timeline">
      {steps.map((step, i) => {
        const state = stepState(step);
        const time = stepTime(step, state);
        return (
          <li key={step.key} className="relative flex gap-3">
            {i < steps.length - 1 ? (
              <span className="absolute left-[4.5px] top-4 h-[calc(100%+4px)] w-px bg-[var(--line)]" aria-hidden />
            ) : null}
            <span className={`relative mt-1 size-2.5 shrink-0 rounded-full ${DOT[state]}`} aria-hidden />
            <div className="min-w-0">
              <div
                className={`text-sm font-medium ${
                  state === 'failed'
                    ? 'text-[#b42318]'
                    : state === 'pending' || state === 'skipped'
                      ? 'text-[var(--muted)]'
                      : ''
                }`}
              >
                {step.label}
              </div>
              {time ? <div className="text-xs text-[var(--muted)]">{time}</div> : null}
              {step.note ? <div className="mt-0.5 text-xs text-[var(--muted)]">{step.note}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function BookingDetailDrawer({ bookingId, onClose }: { bookingId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const detail = useQuery({
    queryKey: ['ops-booking', bookingId],
    queryFn: () => apiRequest<BookingDetail>(`/admin/bookings/${bookingId}`),
    enabled: Boolean(bookingId),
  });

  const cancel = useMutation({
    mutationFn: () =>
      apiRequest(`/admin/bookings/${bookingId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      }),
    onSuccess: () => {
      setConfirming(false);
      setReason('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['ops-bookings'] });
      void qc.invalidateQueries({ queryKey: ['ops-booking', bookingId] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  function close() {
    setConfirming(false);
    setReason('');
    setError('');
    onClose();
  }

  const d = detail.data;
  const appointment = d ? isAppointmentService(d.service) : false;
  const mode = d ? paymentModeLabel(d.payment.mode ?? d.paymentMode) : null;
  const cancellable = d ? !isTerminalStatus(d.status) && can(user?.role, 'bookings') : false;

  return (
    <Drawer
      open={Boolean(bookingId)}
      title={d ? d.bookingId : 'Booking'}
      subtitle={d ? <span className="capitalize">{d.service} booking</span> : undefined}
      onClose={close}
    >
      {detail.isLoading ? <SkeletonRows rows={5} /> : null}
      {detail.isError ? <ErrorText>{(detail.error as Error).message}</ErrorText> : null}
      {d ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={bookingStatusTone(d.service, d.status)} label={bookingStatusLabel(d.service, d.status)} />
            <StatusPill status={d.payment.status} label={`Payment ${paymentStatusLabel(d.payment.status)}`} />
          </div>

          {appointment && d.status === 'pending' ? (
            <div className="rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2.5 text-sm text-[#b54708]">
              {d.respondBy ? (
                <>
                  Waiting for {d.providerName} to accept. Respond-by{' '}
                  <span className="font-semibold">{formatDateTime(d.respondBy)}</span> ({relativeFromNow(d.respondBy)}).
                </>
              ) : (
                <>Waiting for {d.providerName} to accept. The request expires automatically if unanswered.</>
              )}
            </div>
          ) : null}

          <Timeline d={d} />

          <Card className="p-4!">
            <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--muted)] mb-1">Patient</div>
            <div className="font-medium text-sm">{d.patientName}</div>
            <div className="text-sm text-[var(--muted)]">{d.patientPhone ?? 'No phone on file'}</div>
            {d.pickup ? <DetailRow label="Pickup">{d.pickup}</DetailRow> : null}
            {d.dropoff ? <DetailRow label="Drop-off">{d.dropoff}</DetailRow> : null}
            {d.collectionAddress ? <DetailRow label="Collection">{d.collectionAddress}</DetailRow> : null}
            {d.deliveryAddress ? <DetailRow label="Delivery">{d.deliveryAddress}</DetailRow> : null}
            {d.notes ? <DetailRow label="Notes">{d.notes}</DetailRow> : null}
          </Card>

          <Card className="p-4! divide-y divide-[var(--line)]">
            <DetailRow label="Provider">{d.providerName}</DetailRow>
            <DetailRow label={appointment ? 'Visit time' : 'Created'}>
              {formatDateTime(d.scheduledAt)}
              <div className="text-xs font-normal text-[var(--muted)]">{relativeFromNow(d.scheduledAt)}</div>
            </DetailRow>
            <DetailRow label="Amount">{formatInr(d.payment.amount)}</DetailRow>
            <DetailRow label="Payment status">
              <span className="capitalize">{paymentStatusLabel(d.payment.status)}</span>
            </DetailRow>
            {mode ? (
              <DetailRow label="Payment mode">
                {mode}
                {d.payment.channel ? (
                  <div className="text-xs font-normal text-[var(--muted)]">via {d.payment.channel}</div>
                ) : null}
              </DetailRow>
            ) : null}
            {d.cancelledBy ? <DetailRow label="Cancelled by">{byLabel(d.cancelledBy)}</DetailRow> : null}
            {d.cancelReason ? <DetailRow label="Cancel reason">{d.cancelReason}</DetailRow> : null}
            {d.rejectReason ? <DetailRow label="Decline reason">{d.rejectReason}</DetailRow> : null}
          </Card>

          {d.items && d.items.length > 0 ? (
            <Card className="p-4!">
              <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--muted)] mb-2">Items</div>
              <ul className="space-y-1 text-sm">
                {d.items.map((item, i) => (
                  <li key={`${item.name}-${i}`} className="flex justify-between gap-3">
                    <span>
                      {item.name ?? 'Item'} {item.quantity ? `× ${item.quantity}` : ''}
                    </span>
                    {typeof item.price === 'number' ? <span>{formatInr(item.price)}</span> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {cancellable ? (
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Cancel booking
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={`Cancel ${d?.bookingId ?? 'booking'}?`}
        message={
          appointment ? (
            <>
              The slot is released, the patient and provider are notified, and any prepaid amount is refunded in full.
              This cannot be undone.
            </>
          ) : (
            <>The booking is marked cancelled and the patient sees the reason below. This cannot be undone.</>
          )
        }
        confirmLabel="Cancel booking"
        busyLabel="Cancelling…"
        busy={cancel.isPending}
        disabled={reason.trim().length < 3}
        error={error}
        onConfirm={() => cancel.mutate()}
        onClose={() => {
          setConfirming(false);
          setError('');
        }}
      >
        <div>
          <FieldLabel htmlFor="cancel-reason" hint="(shared with the patient, min 3 characters)">
            Reason
          </FieldLabel>
          <Textarea
            id="cancel-reason"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Doctor unavailable due to emergency"
          />
        </div>
      </ConfirmDialog>
    </Drawer>
  );
}
