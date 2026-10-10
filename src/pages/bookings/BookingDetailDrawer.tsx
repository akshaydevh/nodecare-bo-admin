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
 * The admin detail endpoint returns a derived 3-step timeline ({key,label,at,state}).
 * Appointment serializers expose a real status history ({status,label,at,by,note});
 * both shapes are accepted so the drawer picks up richer data when available.
 */
type ApiTimelineEntry = {
  key?: string;
  status?: string;
  label: string;
  at: string | null;
  state?: string;
  by?: string | null;
  note?: string | null;
};

export type BookingDetail = {
  id: string;
  bookingId: string;
  service: string;
  patientName: string;
  providerName: string;
  scheduledAt: string;
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
  timeline: ApiTimelineEntry[];
  payment: { amount: number; status: string; mode?: string | null };
  cancelReason?: string | null;
  rejectReason?: string | null;
  respondBy?: string | null;
  paymentMode?: string | null;
};

type StepState = 'done' | 'current' | 'pending' | 'failed' | 'skipped';
type Step = { key: string; label: string; at: string | null; state: StepState; note?: string | null };

const DOT: Record<StepState, string> = {
  done: 'bg-[var(--brand)]',
  current: 'bg-[#f79009] ring-4 ring-[#fffaeb]',
  pending: 'bg-[#d0d5dd]',
  failed: 'bg-[#f04438]',
  skipped: 'bg-[#d0d5dd]',
};

function appointmentSteps(d: BookingDetail): Step[] {
  // Real status history from the lifecycle, when the API provides it.
  if (d.timeline.some((t) => t.status)) {
    const steps: Step[] = d.timeline.map((t, i) => ({
      key: `${t.status}-${i}`,
      label: t.label,
      at: t.at,
      note: t.note,
      state: ['rejected', 'expired', 'cancelled', 'no_show'].includes(t.status ?? '') ? 'failed' : 'done',
    }));
    if (d.status === 'pending') {
      steps.push({ key: 'awaiting', label: 'Awaiting provider response', at: null, state: 'current' });
    }
    return steps;
  }

  const requestedAt = d.timeline.find((t) => t.key === 'requested')?.at ?? null;
  const confirmedAt = d.timeline.find((t) => t.key === 'confirmed')?.at ?? null;
  const completedAt = d.timeline.find((t) => t.key === 'completed')?.at ?? null;
  const visit = d.service === 'caretaker' ? 'Visit' : 'Consultation';
  const requested: Step = { key: 'requested', label: 'Booking requested', at: requestedAt, state: 'done' };
  const accepted: Step = {
    key: 'accepted',
    label: `Accepted by ${d.providerName}`,
    at: confirmedAt,
    state: 'done',
  };
  const scheduled: Step = {
    key: 'visit',
    label: `${visit} scheduled`,
    at: d.scheduledAt,
    state: 'pending',
  };

  switch (d.status) {
    case 'pending':
      return [
        requested,
        {
          key: 'awaiting',
          label: `Awaiting response from ${d.providerName}`,
          at: null,
          state: 'current',
          note: d.respondBy
            ? `Respond by ${formatDateTime(d.respondBy)} (${relativeFromNow(d.respondBy)}) or it expires`
            : 'Unanswered requests expire automatically',
        },
        scheduled,
      ];
    case 'confirmed':
      return [requested, accepted, scheduled];
    case 'rejected':
      return [
        requested,
        { key: 'rejected', label: `Declined by ${d.providerName}`, at: null, state: 'failed', note: d.rejectReason },
      ];
    case 'expired':
      return [
        requested,
        { key: 'expired', label: 'Request expired', at: null, state: 'failed', note: 'Provider did not respond in time' },
      ];
    case 'completed':
      return [requested, accepted, { key: 'completed', label: `${visit} completed`, at: completedAt, state: 'done' }];
    case 'no_show':
      return [requested, accepted, { key: 'no_show', label: 'Patient did not show up', at: null, state: 'failed' }];
    case 'cancelled':
      return [requested, { key: 'cancelled', label: 'Cancelled', at: null, state: 'failed', note: d.cancelReason }];
    default:
      return [requested];
  }
}

function serviceSteps(d: BookingDetail): Step[] {
  const steps: Step[] = d.timeline.map((t, i) => ({
    key: t.key ?? String(i),
    label: t.label,
    at: t.at,
    state: (t.state as StepState) ?? 'pending',
  }));
  if (d.status === 'cancelled') {
    steps.push({ key: 'cancelled', label: 'Cancelled', at: null, state: 'failed', note: d.cancelReason });
  }
  return steps;
}

function Timeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative space-y-4" aria-label="Booking timeline">
      {steps.map((step, i) => (
        <li key={step.key} className="relative flex gap-3">
          {i < steps.length - 1 ? (
            <span className="absolute left-[4.5px] top-4 h-[calc(100%+4px)] w-px bg-[var(--line)]" aria-hidden />
          ) : null}
          <span className={`relative mt-1 size-2.5 shrink-0 rounded-full ${DOT[step.state]}`} aria-hidden />
          <div className="min-w-0">
            <div
              className={`text-sm font-medium ${
                step.state === 'failed'
                  ? 'text-[#b42318]'
                  : step.state === 'pending' || step.state === 'skipped'
                    ? 'text-[var(--muted)]'
                    : ''
              }`}
            >
              {step.label}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {step.at ? formatDateTime(step.at) : step.state === 'current' ? 'In progress' : null}
            </div>
            {step.note ? <div className="mt-0.5 text-xs text-[var(--muted)]">{step.note}</div> : null}
          </div>
        </li>
      ))}
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
  const mode = d ? paymentModeLabel(d.paymentMode ?? d.payment.mode) : null;
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

          <Timeline steps={appointment ? appointmentSteps(d) : serviceSteps(d)} />

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
            {mode ? <DetailRow label="Payment mode">{mode}</DetailRow> : null}
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
