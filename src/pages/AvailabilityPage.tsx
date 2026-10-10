import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconCalendarClock } from '../components/icons';
import { Avatar, Card, EmptyState, ErrorText, PageHeader, SkeletonRows } from '../components/ui';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth';
import { istDateString } from '../lib/format';
import { can } from '../lib/roles';
import { DayPanel } from './availability/DayPanel';
import { MonthCalendar } from './availability/MonthCalendar';
import { ProviderPicker } from './availability/ProviderPicker';
import { RulesPanel } from './availability/RulesPanel';
import {
  availabilityKey,
  monthBounds,
  PROVIDER_TYPE_LABEL,
  targetQs,
  type CalendarResponse,
  type ProviderType,
  type RulesResponse,
  type Target,
} from './availability/types';

const PROVIDER_TYPES = new Set<string>(['doctor', 'nurse', 'clinic', 'hospital']);

function initialsOf(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function ProviderCalendar({ target }: { target: Target }) {
  const { user } = useAuth();
  const canEdit = can(user?.role, 'network');
  const today = istDateString();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1);
  const [selectedDate, setSelectedDate] = useState(today);

  const rules = useQuery({
    queryKey: [...availabilityKey(target), 'rules'],
    queryFn: () => apiRequest<RulesResponse>(`/admin/availability/rules${targetQs(target)}`),
  });

  const { from, to } = monthBounds(year, month);
  const calendar = useQuery({
    queryKey: [...availabilityKey(target), 'calendar', from, to],
    queryFn: () => apiRequest<CalendarResponse>(`/admin/availability/calendar${targetQs(target, { from, to })}`),
    placeholderData: keepPreviousData,
  });

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  }

  if (rules.isLoading) {
    return (
      <Card>
        <SkeletonRows rows={4} />
      </Card>
    );
  }
  if (rules.isError || !rules.data) {
    return (
      <Card>
        <ErrorText>{(rules.error as Error | null)?.message ?? 'Could not load this calendar.'}</ErrorText>
      </Card>
    );
  }

  const info = rules.data.target;
  const days = calendar.data && calendar.data.from === from ? calendar.data.days : undefined;
  const monthTotals = (days ?? []).reduce(
    (acc, d) => ({
      open: acc.open + d.available,
      booked: acc.booked + d.booked,
      pending: acc.pending + d.pendingRequests,
      closed: acc.closed + (d.closed ? 1 : 0),
    }),
    { open: 0, booked: 0, pending: 0, closed: 0 },
  );

  return (
    <div className="space-y-5 min-w-0">
      <Card className="flex flex-wrap items-center gap-4">
        <Avatar initials={initialsOf(info.name)} src={info.photoUrl} className="size-12! text-sm" />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold truncate">{info.name}</div>
          <div className="text-sm text-[var(--muted)]">
            {PROVIDER_TYPE_LABEL[info.providerType]}
            {info.facilities.length > 0 ? ` · ${info.facilities.map((f) => f.name).join(', ')}` : ''}
          </div>
        </div>
        <dl className="flex gap-6 text-sm">
          {[
            ['Open this month', monthTotals.open],
            ['Booked', monthTotals.booked],
            ['Awaiting response', monthTotals.pending],
            ['Closed days', monthTotals.closed],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-xs text-[var(--muted)]">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{days ? value : '—'}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {!canEdit ? (
        <p className="text-sm text-[var(--muted)]">
          You can view this calendar. Changing availability needs an Ops Admin or Super Admin role.
        </p>
      ) : null}

      <RulesPanel target={target} info={info} rules={rules.data.rules} canEdit={canEdit} />

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <MonthCalendar
          year={year}
          month={month}
          days={days}
          loading={calendar.isFetching && !days}
          error={calendar.isError ? (calendar.error as Error).message : null}
          today={today}
          selected={selectedDate}
          onSelect={setSelectedDate}
          onMonth={shiftMonth}
        />
        <DayPanel key={selectedDate} target={target} info={info} date={selectedDate} today={today} canEdit={canEdit} />
      </div>
    </div>
  );
}

export function AvailabilityPage() {
  const [params, setParams] = useSearchParams();
  const type = params.get('type');
  const id = params.get('id');
  const target: Target | null =
    type && id && PROVIDER_TYPES.has(type) ? { providerType: type as ProviderType, providerId: id } : null;

  return (
    <div>
      <PageHeader
        eyebrow="Network / Availability"
        title="Availability"
        subtitle="Manage the bookable hours of any doctor, caretaker, clinic or hospital: recurring schedules, closed days and one-off slots. Times are in IST."
      />
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] items-start">
        <div className="lg:sticky lg:top-4">
          <ProviderPicker
            selected={target}
            onSelect={(t) => setParams({ type: t.providerType, id: t.providerId })}
          />
        </div>
        {target ? (
          <ProviderCalendar key={`${target.providerType}-${target.providerId}`} target={target} />
        ) : (
          <Card>
            <EmptyState
              icon={<IconCalendarClock className="size-5" />}
              title="Pick a provider to see their calendar"
              body="Search on the left. Schedules generate bookable slots automatically; you can close days or open extra slots on top."
            />
          </Card>
        )}
      </div>
    </div>
  );
}
