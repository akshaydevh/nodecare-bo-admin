import { Button, Card, ErrorText, SkeletonRows } from '../../components/ui';
import { WEEKDAYS, weekdayOf, type CalendarDay } from './types';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}

export function MonthCalendar({
  year,
  month,
  days,
  loading,
  error,
  today,
  selected,
  onSelect,
  onMonth,
}: {
  year: number;
  month: number;
  days: CalendarDay[] | undefined;
  loading: boolean;
  error: string | null;
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
  onMonth: (delta: number) => void;
}) {
  const leading = days && days.length > 0 ? weekdayOf(days[0]!.date) : 0;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-[15px] font-semibold">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="size-8 p-0" aria-label="Previous month" onClick={() => onMonth(-1)}>
            ‹
          </Button>
          <Button variant="ghost" className="size-8 p-0" aria-label="Next month" onClick={() => onMonth(1)}>
            ›
          </Button>
        </div>
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {loading && !days ? (
        <SkeletonRows rows={5} className="h-14" />
      ) : (
        <div role="grid" aria-label={`${MONTHS[month]} ${year}`}>
          <div className="grid grid-cols-7 gap-1.5 mb-1.5" role="row">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                role="columnheader"
                className="text-center text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--muted)]"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: leading }, (_, i) => (
              <div key={`pad-${i}`} aria-hidden />
            ))}
            {(days ?? []).map((day) => {
              const isSelected = day.date === selected;
              const isToday = day.date === today;
              const past = day.date < today;
              const label = day.closed
                ? `${day.date}: closed`
                : `${day.date}: ${day.available} open, ${day.booked} booked, ${day.blocked} blocked${
                    day.pendingRequests ? `, ${day.pendingRequests} awaiting response` : ''
                  }`;
              return (
                <button
                  key={day.date}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={label}
                  onClick={() => onSelect(day.date)}
                  className={`relative min-h-[76px] rounded-lg border p-1.5 text-left transition ${
                    isSelected
                      ? 'border-[var(--brand)] ring-2 ring-[var(--brand)]/20'
                      : 'border-[var(--line)] hover:border-[var(--brand)]/50'
                  } ${
                    day.closed
                      ? 'bg-[repeating-linear-gradient(135deg,#f8fafb_0,#f8fafb_6px,#eef1f4_6px,#eef1f4_8px)]'
                      : past
                        ? 'bg-[#fafbfc]'
                        : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        isToday
                          ? 'inline-grid size-5 place-items-center rounded-full bg-[var(--brand)] text-white'
                          : past
                            ? 'text-[var(--muted)]'
                            : ''
                      }`}
                    >
                      {Number(day.date.slice(8))}
                    </span>
                    {day.pendingRequests > 0 ? (
                      <span
                        className="rounded-full bg-[#fffaeb] px-1.5 text-[10px] font-semibold text-[#b54708]"
                        title="Requests awaiting provider response"
                      >
                        {day.pendingRequests} req
                      </span>
                    ) : null}
                  </div>
                  {day.closed ? (
                    <div className="mt-2 text-[11px] font-medium text-[var(--muted)]">Closed</div>
                  ) : day.total > 0 ? (
                    <div className="mt-1.5 space-y-0.5 text-[11px] leading-tight">
                      {day.available > 0 ? <div className="text-[#067647]">{day.available} open</div> : null}
                      {day.booked > 0 ? <div className="text-[#175cd3]">{day.booked} booked</div> : null}
                      {day.blocked > 0 ? <div className="text-[var(--muted)]">{day.blocked} blocked</div> : null}
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-[#c0c7cf]">No slots</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        <Legend className="bg-[#12b76a]" label="Open slots" />
        <Legend className="bg-[#2e90fa]" label="Booked / held" />
        <Legend className="bg-[#98a2b3]" label="Blocked" />
        <Legend className="bg-[#f79009]" label="Requests awaiting provider" />
      </div>
    </Card>
  );
}
