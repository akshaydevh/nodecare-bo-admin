import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button, ErrorText, FieldLabel, Input, Modal, Select } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import {
  availabilityKey,
  SLOT_LENGTHS,
  WEEKDAYS,
  windowsError,
  type Rule,
  type Target,
  type TargetInfo,
  type TimeWindow,
} from './types';

type Draft = {
  kind: 'weekly' | 'date_range';
  label: string;
  daysOfWeek: number[];
  startDate: string;
  endDate: string;
  windows: TimeWindow[];
  slotMinutes: number;
  fee: string;
  facilityId: string;
  isActive: boolean;
};

function draftFrom(rule: Rule | null, info: TargetInfo): Draft {
  if (rule) {
    return {
      kind: rule.kind,
      label: rule.label ?? '',
      daysOfWeek: rule.daysOfWeek,
      startDate: rule.startDate ?? '',
      endDate: rule.endDate ?? '',
      windows: rule.windows.map((w) => ({ ...w })),
      slotMinutes: rule.slotMinutes,
      fee: rule.fee === null ? '' : String(rule.fee),
      facilityId: rule.facilityId ?? '',
      isActive: rule.isActive,
    };
  }
  return {
    kind: 'weekly',
    label: '',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    startDate: '',
    endDate: '',
    windows: [{ start: '10:00', end: '13:00' }],
    slotMinutes: info.defaultSlotMinutes,
    fee: '',
    facilityId: info.lockedFacility?.id ?? (info.facilities.length === 1 ? info.facilities[0]!.id : ''),
    isActive: true,
  };
}

export type RuleSaveResult = { slotsCreated?: number; slotsRemoved?: number };

export function RuleForm({
  open,
  rule,
  target,
  info,
  onClose,
  onSaved,
}: {
  open: boolean;
  rule: Rule | null;
  target: Target;
  info: TargetInfo;
  onClose: () => void;
  onSaved: (result: RuleSaveResult) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(rule, info));
  const [error, setError] = useState('');
  const needsFacility = !rule && !info.lockedFacility && info.facilities.length > 1;

  function patch(next: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...next }));
  }

  function validate(): string | null {
    if (draft.kind === 'weekly' && draft.daysOfWeek.length === 0) return 'Pick at least one weekday';
    if (draft.kind === 'date_range' && (!draft.startDate || !draft.endDate)) {
      return 'Date ranges need a start and end date';
    }
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      return 'End date must be on or after the start date';
    }
    const w = windowsError(draft.windows);
    if (w) return w;
    if (!Number.isInteger(draft.slotMinutes) || draft.slotMinutes < 5 || draft.slotMinutes > 480) {
      return 'Slot length must be between 5 and 480 minutes';
    }
    if (draft.fee && (Number.isNaN(Number(draft.fee)) || Number(draft.fee) < 0)) return 'Fee must be a positive number';
    if (needsFacility && !draft.facilityId) return 'Choose which location these hours are for';
    return null;
  }

  const save = useMutation({
    mutationFn: () => {
      const fee = draft.fee.trim() === '' ? undefined : Number(draft.fee);
      if (rule) {
        return apiRequest<RuleSaveResult>(`/admin/availability/rules/${rule.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            label: draft.label.trim(),
            daysOfWeek: draft.daysOfWeek,
            startDate: draft.startDate || null,
            endDate: draft.endDate || null,
            windows: draft.windows,
            slotMinutes: draft.slotMinutes,
            fee: fee ?? null,
            isActive: draft.isActive,
          }),
        });
      }
      return apiRequest<RuleSaveResult>('/admin/availability/rules', {
        method: 'POST',
        body: JSON.stringify({
          ...target,
          kind: draft.kind,
          ...(draft.label.trim() ? { label: draft.label.trim() } : {}),
          daysOfWeek: draft.daysOfWeek,
          ...(draft.startDate ? { startDate: draft.startDate } : {}),
          ...(draft.endDate ? { endDate: draft.endDate } : {}),
          windows: draft.windows,
          slotMinutes: draft.slotMinutes,
          ...(fee !== undefined ? { fee } : {}),
          ...(draft.facilityId ? { facilityId: draft.facilityId } : {}),
          isActive: draft.isActive,
        }),
      });
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: availabilityKey(target) });
      onSaved(result);
    },
    onError: (err: Error) => setError(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validate();
    setError(problem ?? '');
    if (!problem) save.mutate();
  }

  return (
    <Modal open={open} title={rule ? 'Edit schedule' : 'Add schedule'} onClose={onClose} size="lg">
      <form className="space-y-4" onSubmit={onSubmit}>
        {!rule ? (
          <fieldset>
            <legend className="block text-xs font-semibold text-[var(--muted)] mb-1">Repeats</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['weekly', 'Every week', 'On selected weekdays, optionally between dates'],
                  ['date_range', 'Date range', 'Only between two dates (e.g. a camp)'],
                ] as const
              ).map(([value, title, hint]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                    draft.kind === value
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                      : 'border-[var(--line)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="rule-kind"
                    aria-label={title}
                    className="sr-only"
                    checked={draft.kind === value}
                    onChange={() => patch({ kind: value })}
                  />
                  <span className="font-medium">{title}</span>
                  <span className="block text-xs text-[var(--muted)]">{hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div>
          <FieldLabel htmlFor="rule-label" hint="(optional)">
            Label
          </FieldLabel>
          <Input
            id="rule-label"
            maxLength={60}
            placeholder="e.g. Regular OPD hours"
            value={draft.label}
            onChange={(e) => patch({ label: e.target.value })}
          />
        </div>

        <fieldset>
          <legend className="block text-xs font-semibold text-[var(--muted)] mb-1">
            Weekdays{draft.kind === 'date_range' ? ' (leave empty for every day)' : ''}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((day, i) => {
              const on = draft.daysOfWeek.includes(i);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    patch({
                      daysOfWeek: on ? draft.daysOfWeek.filter((d) => d !== i) : [...draft.daysOfWeek, i].sort(),
                    })
                  }
                  className={`h-9 w-12 rounded-lg text-sm font-medium border ${
                    on
                      ? 'bg-[var(--brand)] border-[var(--brand)] text-white'
                      : 'bg-white border-[var(--line)] text-[var(--ink)] hover:bg-[var(--brand-soft)]'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="rule-start" hint={draft.kind === 'weekly' ? '(optional)' : undefined}>
              Start date
            </FieldLabel>
            <Input id="rule-start" type="date" value={draft.startDate} onChange={(e) => patch({ startDate: e.target.value })} />
          </div>
          <div>
            <FieldLabel htmlFor="rule-end" hint={draft.kind === 'weekly' ? '(optional)' : undefined}>
              End date
            </FieldLabel>
            <Input
              id="rule-end"
              type="date"
              min={draft.startDate || undefined}
              value={draft.endDate}
              onChange={(e) => patch({ endDate: e.target.value })}
            />
          </div>
        </div>

        <fieldset>
          <legend className="block text-xs font-semibold text-[var(--muted)] mb-1">Time windows (IST)</legend>
          <div className="space-y-2">
            {draft.windows.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label={`Window ${i + 1} start`}
                  value={w.start}
                  onChange={(e) =>
                    patch({ windows: draft.windows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)) })
                  }
                  className="max-w-[140px]"
                />
                <span className="text-[var(--muted)] text-sm">to</span>
                <Input
                  type="time"
                  aria-label={`Window ${i + 1} end`}
                  value={w.end}
                  onChange={(e) =>
                    patch({ windows: draft.windows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)) })
                  }
                  className="max-w-[140px]"
                />
                {draft.windows.length > 1 ? (
                  <button
                    type="button"
                    className="text-sm text-[var(--danger)] px-2"
                    aria-label={`Remove window ${i + 1}`}
                    onClick={() => patch({ windows: draft.windows.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {draft.windows.length < 6 ? (
            <button
              type="button"
              className="mt-2 text-sm text-[var(--brand)] font-medium"
              onClick={() => {
                const last = draft.windows.at(-1);
                patch({ windows: [...draft.windows, { start: last?.end ?? '14:00', end: '17:00' }] });
              }}
            >
              + Add window
            </button>
          ) : null}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="rule-slot">Slot length</FieldLabel>
            <Select
              id="rule-slot"
              value={draft.slotMinutes}
              onChange={(e) => patch({ slotMinutes: Number(e.target.value) })}
            >
              {[...new Set([...SLOT_LENGTHS, draft.slotMinutes])]
                .sort((a, b) => a - b)
                .map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="rule-fee" hint="(blank = profile fee)">
              Fee (₹)
            </FieldLabel>
            <Input
              id="rule-fee"
              type="number"
              min={0}
              inputMode="decimal"
              value={draft.fee}
              onChange={(e) => patch({ fee: e.target.value })}
            />
          </div>
        </div>

        {rule ? (
          rule.facilityName ? (
            <p className="text-sm text-[var(--muted)]">Location: {rule.facilityName}</p>
          ) : null
        ) : info.facilities.length > 0 ? (
          <div>
            <FieldLabel htmlFor="rule-facility">Location</FieldLabel>
            <Select
              id="rule-facility"
              value={draft.facilityId}
              disabled={Boolean(info.lockedFacility) || info.facilities.length === 1}
              onChange={(e) => patch({ facilityId: e.target.value })}
            >
              {needsFacility ? <option value="">Choose a location…</option> : null}
              {info.facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.type})
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.isActive}
            aria-label="Active"
            onChange={(e) => patch({ isActive: e.target.checked })}
            className="size-4 accent-[var(--brand)]"
          />
          Active — generate bookable slots from this schedule
        </label>

        <ErrorText>{error}</ErrorText>
        {rule ? (
          <p className="text-xs text-[var(--muted)]">
            Saving regenerates future unbooked slots for this schedule. Booked slots are never removed.
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : rule ? 'Save changes' : 'Add schedule'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
