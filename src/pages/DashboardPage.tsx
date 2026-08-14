import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  IconBarChart,
  IconCalendar,
  IconClock,
  IconCurrency,
  IconPlug,
} from '../components/icons';
import { Avatar, Button, Card, KpiCard, PageHeader, StatusPill, Table } from '../components/ui';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDateLong, formatInrCompact, greeting, relativeTime } from '../lib/format';

type Dashboard = {
  kpis: {
    bookingsToday: { value: number; changePct: number; hint: string };
    revenueMtd: { value: number; changePct: number; hint: string };
    activeProviders: { value: number; changeAbs: number; hint: string };
    pendingVerifications: { value: number; hint: string };
  };
  revenueTrend: { month: string; total: number }[];
  bookingsByService: { service: string; count: number }[];
  pendingApprovals: {
    id: string;
    applicant: string;
    initials: string;
    type: string;
    submittedAt: string;
    status: string;
  }[];
  recentActivity: { id: string; action: string; resourceType: string; at: string }[];
};

const SERVICE_COLORS: Record<string, string> = {
  doctor: '#0e7a81',
  diagnostics: '#175cd3',
  pharmacy: '#dc6803',
  ambulance: '#f04438',
  caretaker: '#7a5af8',
};

function formatAxis(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(0)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(0)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n}`;
}

function LineChart({ points }: { points: { month: string; total: number }[] }) {
  const max = Math.max(...points.map((p) => p.total), 1);
  const w = 560;
  const h = 220;
  const padL = 52;
  const padR = 16;
  const padT = 28;
  const padB = 32;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const coords = points.map((p, i) => {
    const x = padL + (i * innerW) / Math.max(points.length - 1, 1);
    const y = padT + innerH - (p.total / max) * innerH;
    return { x, y, ...p };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `${padL},${padT + innerH} ${line} ${coords.at(-1)?.x ?? padL},${padT + innerH}`;
  const ticks = [1, 0.75, 0.5, 0.25];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[220px]">
      <defs>
        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e7a81" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#0e7a81" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => {
        const y = padT + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#eef2f4" strokeWidth="1" />
            <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#98a2b3">
              {formatAxis(max * t)}
            </text>
          </g>
        );
      })}
      <text x={padL - 8} y={padT - 4} textAnchor="end" fontSize="10" fill="#98a2b3">
        ₹
      </text>
      <polygon fill="url(#revFill)" points={area} />
      <polyline fill="none" stroke="#0e7a81" strokeWidth="2.5" strokeLinejoin="round" points={line} />
      {coords.map((c) => (
        <circle key={c.month} cx={c.x} cy={c.y} r="4" fill="#fff" stroke="#0e7a81" strokeWidth="2" />
      ))}
      {coords.map((c) => (
        <text key={`${c.month}-l`} x={c.x} y={h - 8} textAnchor="middle" fontSize="11" fill="#6b7280">
          {c.month}
        </text>
      ))}
    </svg>
  );
}

function Donut({ slices }: { slices: { service: string; count: number }[] }) {
  const total = slices.reduce((a, b) => a + b.count, 0) || 1;
  let acc = 0;
  const stops = slices.map((s) => {
    const start = (acc / total) * 360;
    acc += s.count;
    const end = (acc / total) * 360;
    return `${SERVICE_COLORS[s.service] ?? '#98a2b3'} ${start}deg ${end}deg`;
  });
  return (
    <div className="flex flex-col items-center gap-6 pt-2">
      <div
        className="size-44 rounded-full"
        style={{ background: `conic-gradient(${stops.join(',')})` }}
      >
        <div className="size-full rounded-full p-[42px]">
          <div className="size-full rounded-full bg-white" />
        </div>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px]">
        {slices.map((s) => (
          <li key={s.service} className="flex items-center gap-2 capitalize text-[var(--muted)]">
            <span className="size-2.5 rounded-full" style={{ background: SERVICE_COLORS[s.service] }} />
            {s.service}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeartbeatDivider() {
  return (
    <div className="py-1 text-[var(--brand)]">
      <svg viewBox="0 0 960 28" className="w-full h-7" aria-hidden>
        <path
          d="M0 14 H392 L408 14 L418 5 L430 23 L442 8 L452 14 H508 L524 14 L534 5 L546 23 L558 8 L568 14 H960"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="480" cy="14" r="3.2" fill="currentColor" />
      </svg>
    </div>
  );
}

function activityColor(resourceType: string) {
  const key = resourceType.toLowerCase();
  if (key.includes('ambulance')) return '#f04438';
  if (key.includes('doctor')) return '#0e7a81';
  if (key.includes('diagnos') || key.includes('centre')) return '#175cd3';
  if (key.includes('pharma')) return '#dc6803';
  if (key.includes('caretaker')) return '#7a5af8';
  if (key.includes('payout') || key.includes('payment')) return '#f59e0b';
  return '#12b76a';
}

function formatActivity(action: string, resourceType: string) {
  const cleaned = action.replace(/^admin\./, '').replace(/[._]/g, ' ').trim();
  const titled = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  return resourceType ? `${titled} · ${resourceType}` : titled;
}

function reviewPath(type: string) {
  const key = type.toLowerCase();
  if (key.includes('doctor')) return '/doctors';
  if (key.includes('clinic') || key.includes('hospital') || key.includes('medical')) return '/medical-centres';
  if (key.includes('diagnos') || key.includes('lab') || key.includes('centre')) return '/centres';
  return '/providers';
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['ops-dashboard'],
    queryFn: () => apiRequest<Dashboard>('/admin/ops/dashboard'),
  });
  const firstName = (user?.name || user?.username || 'there').split(' ')[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={formatDateLong()}
        title={`${greeting()}, ${firstName}`}
        subtitle="Here's how the network is performing across every service line today."
        action={
          <Link to="/reports">
            <Button variant="ghost">
              <IconBarChart className="size-4" />
              Export summary
            </Button>
          </Link>
        }
      />
      {isLoading ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}
      {error ? <p className="text-sm text-[var(--danger)]">{(error as Error).message}</p> : null}
      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Bookings today"
              value={data.kpis.bookingsToday.value.toLocaleString('en-IN')}
              hint={`${data.kpis.bookingsToday.changePct >= 0 ? '▲' : '▼'} ${Math.abs(data.kpis.bookingsToday.changePct).toFixed(1)}% ${data.kpis.bookingsToday.hint}`}
              tone={data.kpis.bookingsToday.changePct >= 0 ? 'up' : 'down'}
              icon={<IconCalendar className="size-[18px]" />}
              iconClassName="bg-[#e6f4f4] text-[var(--brand)]"
            />
            <KpiCard
              label="Revenue (MTD)"
              value={formatInrCompact(data.kpis.revenueMtd.value)}
              hint={`${data.kpis.revenueMtd.changePct >= 0 ? '▲' : '▼'} ${Math.abs(data.kpis.revenueMtd.changePct).toFixed(1)}% ${data.kpis.revenueMtd.hint}`}
              tone={data.kpis.revenueMtd.changePct >= 0 ? 'up' : 'down'}
              icon={<IconCurrency className="size-[18px]" />}
              iconClassName="bg-[#ecfdf3] text-[var(--success)]"
            />
            <KpiCard
              label="Active providers"
              value={data.kpis.activeProviders.value.toLocaleString('en-IN')}
              hint={`▲ ${data.kpis.activeProviders.changeAbs} ${data.kpis.activeProviders.hint}`}
              tone="up"
              icon={<IconPlug className="size-[18px]" />}
              iconClassName="bg-[#eff8ff] text-[var(--info)]"
            />
            <KpiCard
              label="Pending verifications"
              value={String(data.kpis.pendingVerifications.value)}
              hint={`▼ ${data.kpis.pendingVerifications.hint}`}
              tone={data.kpis.pendingVerifications.value > 0 ? 'alert' : 'up'}
              icon={<IconClock className="size-[18px]" />}
              iconClassName="bg-[#fef3f2] text-[var(--danger)]"
            />
          </div>
          <HeartbeatDivider />
          <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <Card>
              <div className="flex justify-between items-center mb-2">
                <div className="font-semibold">Revenue trend — last 6 months</div>
                <Link to="/reports" className="text-sm text-[var(--brand)] font-medium">
                  View report →
                </Link>
              </div>
              <LineChart points={data.revenueTrend} />
            </Card>
            <Card>
              <div className="flex justify-between items-center mb-2">
                <div className="font-semibold">Bookings by service</div>
                <Link to="/bookings" className="text-sm text-[var(--brand)] font-medium">
                  Details →
                </Link>
              </div>
              <Donut slices={data.bookingsByService} />
            </Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <div className="font-semibold mb-3">Pending approvals</div>
              <div className="-mx-5 -mb-5">
                <Table embedded headers={['Applicant', 'Type', 'Submitted', 'Status', '']}>
                  {data.pendingApprovals.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={row.initials} />
                          <span className="font-medium">{row.applicant}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{row.type}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{relativeTime(row.submittedAt)}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link to={reviewPath(row.type)} className="text-[var(--brand)] text-sm font-medium">
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </Table>
                {data.pendingApprovals.length === 0 ? (
                  <p className="text-sm text-[var(--muted)] px-5 py-4">No pending applications.</p>
                ) : null}
              </div>
            </Card>
            <Card>
              <div className="font-semibold mb-4">Recent activity</div>
              <ul className="space-y-4 text-sm">
                {data.recentActivity.map((ev) => (
                  <li key={ev.id} className="flex items-start justify-between gap-3">
                    <span className="flex items-start gap-2.5 min-w-0">
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ background: activityColor(ev.resourceType) }}
                      />
                      <span>{formatActivity(ev.action, ev.resourceType)}</span>
                    </span>
                    <span className="text-[var(--muted)] whitespace-nowrap text-[12px]">
                      {relativeTime(ev.at)}
                    </span>
                  </li>
                ))}
                {data.recentActivity.length === 0 ? (
                  <li className="text-[var(--muted)]">No recent admin actions.</li>
                ) : null}
              </ul>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
