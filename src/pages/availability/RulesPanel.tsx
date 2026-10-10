import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { IconPlus } from '../../components/icons';
import { Button, Card, ConfirmDialog, EmptyState, SectionTitle, StatusPill } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { formatInr } from '../../lib/format';
import { RuleForm, type RuleSaveResult } from './RuleForm';
import { availabilityKey, type Rule, type Target, type TargetInfo } from './types';

function describeResult(r: RuleSaveResult & { bookedSlotsKept?: number }) {
  const parts: string[] = [];
  if (r.slotsCreated !== undefined) parts.push(`${r.slotsCreated} slot${r.slotsCreated === 1 ? '' : 's'} created`);
  if (r.slotsRemoved) parts.push(`${r.slotsRemoved} unbooked removed`);
  if (r.bookedSlotsKept) parts.push(`${r.bookedSlotsKept} booked kept`);
  return parts.join(' · ');
}

export function RulesPanel({
  target,
  info,
  rules,
  canEdit,
}: {
  target: Target;
  info: TargetInfo;
  rules: Rule[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const toggle = useMutation({
    mutationFn: (rule: Rule) =>
      apiRequest<RuleSaveResult>(`/admin/availability/rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !rule.isActive }),
      }),
    onSuccess: (r, rule) => {
      setNotice(`${rule.isActive ? 'Paused' : 'Resumed'} · ${describeResult(r)}`);
      void qc.invalidateQueries({ queryKey: availabilityKey(target) });
    },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: (rule: Rule) =>
      apiRequest<{ slotsRemoved: number; bookedSlotsKept: number }>(`/admin/availability/rules/${rule.id}`, {
        method: 'DELETE',
      }),
    onSuccess: (r) => {
      setDeleting(null);
      setNotice(`Schedule deleted · ${describeResult(r)}`);
      void qc.invalidateQueries({ queryKey: availabilityKey(target) });
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Card>
      <SectionTitle
        action={
          canEdit ? (
            <Button
              variant="soft"
              onClick={() => {
                setEditing('new');
                setNotice('');
                setError('');
              }}
            >
              <IconPlus className="size-4" />
              Add schedule
            </Button>
          ) : null
        }
      >
        Recurring schedules
      </SectionTitle>
      {notice ? (
        <div className="mb-3 rounded-lg bg-[#ecfdf3] px-3 py-2 text-sm text-[#067647]" role="status">
          {notice}
        </div>
      ) : null}
      {error && !deleting ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {rules.length === 0 ? (
        <EmptyState
          title="No schedules yet"
          body="Add weekly hours or a date range and bookable slots are generated automatically."
        />
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{rule.label || (rule.kind === 'weekly' ? 'Weekly hours' : 'Date range')}</span>
                  <StatusPill status={rule.isActive ? 'active' : 'inactive'} label={rule.isActive ? 'Active' : 'Paused'} />
                </div>
                <div className="mt-0.5 text-sm text-[var(--muted)]">{rule.summary}</div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  {[rule.facilityName, rule.fee !== null ? `${formatInr(rule.fee)} per slot` : 'Profile fee']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              {canEdit && rule.editable ? (
                <div className="flex gap-1.5">
                  <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => setEditing(rule)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2.5 py-1.5"
                    disabled={toggle.isPending}
                    onClick={() => {
                      setError('');
                      toggle.mutate(rule);
                    }}
                  >
                    {rule.isActive ? 'Pause' : 'Resume'}
                  </Button>
                  <Button
                    variant="danger"
                    className="px-2.5 py-1.5"
                    onClick={() => {
                      setError('');
                      setDeleting(rule);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <RuleForm
          open
          key={editing === 'new' ? 'new' : editing.id}
          rule={editing === 'new' ? null : editing}
          target={target}
          info={info}
          onClose={() => setEditing(null)}
          onSaved={(r) => {
            setNotice(`Schedule saved · ${describeResult(r)}`);
            setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this schedule?"
        message={
          <>
            <span className="font-medium text-[var(--ink)]">{deleting?.summary}</span>
            <br />
            Future unbooked slots from this schedule are removed. Slots that already have bookings stay, and those
            bookings are not affected.
          </>
        }
        confirmLabel="Delete schedule"
        busyLabel="Deleting…"
        busy={remove.isPending}
        error={error}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => {
          setDeleting(null);
          setError('');
        }}
      />
    </Card>
  );
}
