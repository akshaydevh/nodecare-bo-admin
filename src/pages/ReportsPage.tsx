import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../lib/api';
import { formatInr, formatInrCompact, signedPct } from '../lib/format';
import { Button, Card, KpiCard, PageHeader, Select, Table } from '../components/ui';

type Sales = {
  kpis: {
    totalRevenue: { value: number; changePct: number };
    commissionEarned: { value: number; changePct: number };
    refundsIssued: { value: number; changePct: number };
    netProviderPayout: { value: number; changePct: number };
  };
  stacked: { month: string; doctor: number; diagnostics: number; pharmacy: number; ambulance: number; caretaker: number }[];
  share: { service: string; total: number }[];
  topDoctors: { id: string | null; name: string; bookings: number; revenue: number }[];
};

const COLORS: Record<string, string> = {
  doctor: '#0f6b63',
  diagnostics: '#175cd3',
  pharmacy: '#dc6803',
  ambulance: '#f04438',
  caretaker: '#7a5af8',
};

function StackedBars({ rows }: { rows: Sales['stacked'] }) {
  const max = Math.max(
    ...rows.map((r) => r.doctor + r.diagnostics + r.pharmacy + r.ambulance + r.caretaker),
    1,
  );
  const keys = ['doctor', 'diagnostics', 'pharmacy', 'ambulance', 'caretaker'] as const;
  return (
    <div className="flex items-end gap-3 h-48">
      {rows.map((row) => (
        <div key={row.month} className="flex-1 flex flex-col items-center gap-1 h-full">
          <div className="flex-1 w-full flex flex-col-reverse rounded-md overflow-hidden bg-[#eef2f1]">
            {keys.map((k) => (
              <div
                key={k}
                style={{ height: `${(row[k] / max) * 100}%`, background: COLORS[k] }}
                title={`${k}: ${row[k]}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-[var(--muted)]">{row.month}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ slices }: { slices: { service: string; total: number }[] }) {
  const total = slices.reduce((a, b) => a + b.total, 0) || 1;
  let acc = 0;
  const stops = slices.map((s) => {
    const start = (acc / total) * 360;
    acc += s.total;
    const end = (acc / total) * 360;
    return `${COLORS[s.service] ?? '#98a2b3'} ${start}deg ${end}deg`;
  });
  return (
    <div className="flex items-center gap-5">
      <div className="size-32 rounded-full" style={{ background: `conic-gradient(${stops.join(',')})` }}>
        <div className="size-full p-7">
          <div className="size-full rounded-full bg-white" />
        </div>
      </div>
      <ul className="text-sm space-y-1">
        {slices.map((s) => (
          <li key={s.service} className="flex gap-2 capitalize">
            <span className="size-2 rounded-full mt-1.5" style={{ background: COLORS[s.service] }} />
            {s.service}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportsPage() {
  const [range, setRange] = useState<'3m' | '6m' | '12m'>('6m');
  const { data, isLoading } = useQuery({
    queryKey: ['sales-report', range],
    queryFn: () => apiRequest<Sales>(`/admin/reports/sales?range=${range}`),
  });
  const generate = useMutation({
    mutationFn: () =>
      apiRequest('/admin/reports/generate', {
        method: 'POST',
        body: JSON.stringify({ range }),
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business intelligence"
        title="Reports & Sales"
        subtitle="Track revenue, commissions and performance across the whole network."
        action={
          <div className="flex gap-2">
            <Select value={range} onChange={(e) => setRange(e.target.value as typeof range)} className="w-[160px]">
              <option value="3m">Last 3 months</option>
              <option value="6m">Last 6 months</option>
              <option value="12m">Last 12 months</option>
            </Select>
            <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
              Generate report
            </Button>
          </div>
        }
      />
      {isLoading ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}
      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total revenue"
              value={formatInrCompact(data.kpis.totalRevenue.value)}
              hint={signedPct(data.kpis.totalRevenue.changePct)}
              tone={data.kpis.totalRevenue.changePct >= 0 ? 'up' : 'down'}
            />
            <KpiCard
              label="Commission earned"
              value={formatInrCompact(data.kpis.commissionEarned.value)}
              hint={signedPct(data.kpis.commissionEarned.changePct)}
              tone="up"
            />
            <KpiCard
              label="Refunds issued"
              value={formatInrCompact(data.kpis.refundsIssued.value)}
              hint={signedPct(data.kpis.refundsIssued.changePct)}
              tone="down"
            />
            <KpiCard
              label="Net provider payout"
              value={formatInrCompact(data.kpis.netProviderPayout.value)}
              hint={signedPct(data.kpis.netProviderPayout.changePct)}
              tone="up"
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <div className="font-medium mb-4">Revenue by service line</div>
              <StackedBars rows={data.stacked} />
            </Card>
            <Card>
              <div className="font-medium mb-4">Revenue share</div>
              <Donut slices={data.share} />
            </Card>
          </div>
          <div>
            <div className="font-medium mb-3">Top performing doctors</div>
            <Table headers={['Doctor', 'Bookings', 'Revenue']}>
              {data.topDoctors.map((d) => (
                <tr key={d.id ?? d.name}>
                  <td className="px-4 py-3">{d.name}</td>
                  <td className="px-4 py-3">{d.bookings}</td>
                  <td className="px-4 py-3">{formatInr(d.revenue)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </>
      ) : null}
    </div>
  );
}
