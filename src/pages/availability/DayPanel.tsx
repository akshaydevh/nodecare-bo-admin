import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorText,
  FieldLabel,
  Input,
  Select,
  SkeletonRows,
  Textarea,
} from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { formatInr } from '../../lib/format';
import {
  availabilityKey,
  formatDay,
  SLOT_LENGTHS,
  targetQs,
  windowsError,
  type DayResponse,
  type Slot,
  type Target,
  type TargetInfo,
} from './types';

const SLOT_STYLE: Record<Slot['status'], string> = {
  available: 'border-[#abefc6] bg-[#ecfdf3] text-[#067647] hover:bg-[#d1fadf]',
  blocked: 'border-[var(--line)] bg-[#f2f4f7] text-[#475467] hover:bg-[#e4e7ec]',
  booked: 'border-[#b2ddff] bg-[#eff8ff] text-[#175cd3]',
  held: 'border-[#fedf89] bg-[#fffaeb] text-[#b54708]',
};

function ManualSlotsForm({
  target,
  info,
  date,
  onDone,
}: {
  target: Target;
  info: TargetInfo;
  date: string;
  onDone: (created: number) => void;
}) {
  const qc = useQueryClient();
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('12:00');
  const [slotMinutes, setSlotMinutes] = useState(info.defaultSlotMinutes);
  const [fee, setFee] = useState('');
  const [facilityId, setFacilityId] = useState(
    info.lockedFacility?.id ?? (info.facilities.length === 1 ? info.facilities[0]!.id : ''),
  );
  const [error, setError] = useState('');
  const needsFacility = !info.lockedFacility && info.facilities.length > 1;

  const add = useMutation({
    mutationFn: () =>
      apiRequest<{ slotsCreated: number }>('/admin/availability/slots', {
        method: 'POST',
        body: JSON.stringify({
          ...target,
          date,
          windows: [{ start, end }],
          slotMinutes,
          ...(fee.trim() ? { fee: Number(fee) } : {}),
          ...(facilityId ? { facilityId } : {}),
        }),
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: availabilityKey(target) });
      onDone(r.slotsCreated);
    },
    onError: (err: Error) => setError(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem =
      windowsError([{ start, end }]) ?? (needsFacility && !facilityId ? 'Choose a location' : null);
    setError(problem ?? '');
    if (!problem) add.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-[var(--line)] bg-[#f8fafb] p-3">
      <div className="text-sm font-semibold">Add slots for this day</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel htmlFor="manual-start">From</FieldLabel>
          <Input id="manual-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="manual-end">To</FieldLabel>
          <Input id="manual-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="manual-length">Slot length</FieldLabel>
          <Select id="manual-length" value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))}>
            {[...new Set([...SLOT_LENGTHS, info.defaultSlotMinutes])]
              .sort((a, b) => a - b)
              .map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="manual-fee" hint="(optional)">
            Fee (₹)
          </FieldLabel>
          <Input id="manual-fee" type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />
        </div>
      </div>
      {info.facilities.length > 1 && !info.lockedFacility ? (
        <div>
          <FieldLabel htmlFor="manual-facility">Location</FieldLabel>
          <Select id="manual-facility" value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
            <option value="">Choose a location…</option>
            {info.facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <p className="text-xs text-[var(--muted)]">Adding slots on a closed day reopens it.</p>
      <Button type="submit" disabled={add.isPending}>
        {add.isPending ? 'Adding…' : 'Add slots'}
      </Button>
    </form>
  );
}

export function DayPanel({
  target,
  info,
  date,
  today,
  canEdit,
}: {
  target: Target;
  info: TargetInfo;
  date: string;
  today: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState('');
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const past = date < today;
  const editable = canEdit && !past;

  const day = useQuery({
    queryKey: [...availabilityKey(target), 'day', date],
    queryFn: () => apiRequest<DayResponse>(`/admin/availability/slots${targetQs(target, { date })}`),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: availabilityKey(target) });
  }

  const toggleSlot = useMutation({
    mutationFn: (slot: Slot) =>
      apiRequest(`/admin/availability/slots/${slot.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: slot.status === 'available' ? 'blocked' : 'available' }),
      }),
    onSuccess: () => {
      setError('');
      refresh();
    },
    onError: (err: Error) => setError(err.message),
  });

  const closeDay = useMutation({
    mutationFn: () =>
      apiRequest<{ slotsBlocked: number; bookingsOnDay: number }>(`/admin/availability/days/${date}/close`, {
        method: 'POST',
        body: JSON.stringify({ ...target, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
      }),
    onSuccess: (r) => {
      setClosing(false);
      setReason('');
      setNotice(
        `Day closed · ${r.slotsBlocked} open slot${r.slotsBlocked === 1 ? '' : 's'} blocked${
          r.bookingsOnDay ? ` · ${r.bookingsOnDay} existing booking${r.bookingsOnDay === 1 ? '' : 's'} still active — cancel them from Bookings if needed` : ''
        }`,
      );
      refresh();
    },
    onError: (err: Error) => setError(err.message),
  });

  const openDay = useMutation({
    mutationFn: () =>
      apiRequest<{ slotsReopened: number; slotsCreated: number }>(`/admin/availability/days/${date}/open`, {
        method: 'POST',
        body: JSON.stringify(target),
      }),
    onSuccess: (r) => {
      setNotice(`Day reopened · ${r.slotsReopened} slots reopened, ${r.slotsCreated} generated`);
      refresh();
    },
    onError: (err: Error) => setError(err.message),
  });

  const data = day.data;
  const counts = data
    ? data.slots.reduce(
        (acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }),
        {} as Partial<Record<Slot['status'], number>>,
      )
    : {};

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[15px] font-semibold">{formatDay(date)}</h2>
          {data ? (
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {data.closed
                ? `Closed${data.closedReason ? ` · ${data.closedReason}` : ''}`
                : `${counts.available ?? 0} open · ${(counts.booked ?? 0) + (counts.held ?? 0)} booked · ${counts.blocked ?? 0} blocked`}
            </p>
          ) : null}
        </div>
        {editable && data ? (
          <div className="flex gap-1.5">
            {data.closed ? (
              <Button variant="soft" disabled={openDay.isPending} onClick={() => openDay.mutate()}>
                {openDay.isPending ? 'Reopening…' : 'Reopen day'}
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setClosing(true)}>
                Close day
              </Button>
            )}
            <Button variant="ghost" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
              {adding ? 'Hide' : 'Add slots'}
            </Button>
          </div>
        ) : null}
      </div>

      {notice ? (
        <div className="mb-3 rounded-lg bg-[#ecfdf3] px-3 py-2 text-sm text-[#067647]" role="status">
          {notice}
        </div>
      ) : null}
      {error && !closing ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {past ? <p className="mb-3 text-xs text-[var(--muted)]">Past dates are read-only.</p> : null}

      {adding && editable ? (
        <div className="mb-4">
          <ManualSlotsForm
            target={target}
            info={info}
            date={date}
            onDone={(n) => {
              setAdding(false);
              setNotice(`${n} slot${n === 1 ? '' : 's'} added`);
            }}
          />
        </div>
      ) : null}

      {day.isLoading ? <SkeletonRows rows={3} className="h-9" /> : null}
      {day.isError ? <ErrorText>{(day.error as Error).message}</ErrorText> : null}
      {data && data.slots.length === 0 ? (
        <EmptyState title="No slots on this day" body={editable ? 'Add slots manually or set up a schedule.' : undefined} />
      ) : null}
      {data && data.slots.length > 0 ? (
        <>
          {editable ? (
            <p className="mb-2 text-xs text-[var(--muted)]">Click an open slot to block it, or a blocked slot to reopen it.</p>
          ) : null}
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
            {data.slots.map((slot) => {
              const toggleable = editable && !slot.isPast && (slot.status === 'available' || slot.status === 'blocked');
              const body = (
                <>
                  <span className={`block text-sm font-semibold ${slot.status === 'blocked' ? 'line-through' : ''}`}>
                    {slot.startTime}–{slot.endTime}
                  </span>
                  <span className="block text-[11px] capitalize">
                    {slot.booking?.patientName ?? (slot.status === 'blocked' && slot.blockedBy === 'blackout' ? 'Day closed' : slot.status)}
                  </span>
                  <span className="block text-[11px] opacity-75">{formatInr(slot.consultationFee)}</span>
                </>
              );
              const cls = `block w-full rounded-lg border px-2 py-1.5 text-left ${SLOT_STYLE[slot.status]} ${
                slot.isPast ? 'opacity-50' : ''
              }`;
              return (
                <li key={slot.id}>
                  {slot.booking ? (
                    <Link
                      to={`/bookings?booking=${slot.booking.id}`}
                      className={cls}
                      title={`${slot.booking.bookingId} · ${slot.booking.status}`}
                    >
                      {body}
                    </Link>
                  ) : toggleable ? (
                    <button
                      type="button"
                      className={cls}
                      disabled={toggleSlot.isPending}
                      onClick={() => toggleSlot.mutate(slot)}
                      aria-label={`${slot.startTime} to ${slot.endTime}, ${slot.status}. ${
                        slot.status === 'available' ? 'Block' : 'Reopen'
                      } this slot`}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <ConfirmDialog
        open={closing}
        title={`Close ${formatDay(date)}?`}
        message="All open slots on this day are blocked so patients cannot book them. Existing bookings are not cancelled — handle those from Bookings."
        confirmLabel="Close day"
        busyLabel="Closing…"
        busy={closeDay.isPending}
        error={error}
        onConfirm={() => closeDay.mutate()}
        onClose={() => {
          setClosing(false);
          setError('');
        }}
      >
        <div>
          <FieldLabel htmlFor="close-reason" hint="(optional)">
            Reason
          </FieldLabel>
          <Textarea
            id="close-reason"
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Public holiday, doctor on leave"
            className="min-h-[64px]"
          />
        </div>
      </ConfirmDialog>
    </Card>
  );
}
