import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { Card, PageHeader } from '../components/ui';

type Hit = { id: string; kind: string; title: string; subtitle?: string };
type Result = {
  doctors: Hit[];
  medicalCentres: Hit[];
  centres: Hit[];
  providers: Hit[];
  bookings: Hit[];
};

const LINKS: Record<string, string> = {
  doctor: '/doctors',
  clinic: '/medical-centres',
  hospital: '/medical-centres',
  centre: '/centres',
  ambulance: '/providers',
  pharmacy: '/providers',
  caretaker: '/providers',
  booking: '/bookings',
};

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const { data, isLoading } = useQuery({
    queryKey: ['ops-search', q],
    queryFn: () => apiRequest<Result>(`/admin/ops/search?q=${encodeURIComponent(q)}`),
    enabled: q.length > 0,
  });

  const groups = [
    ['Doctors', data?.doctors],
    ['Medical Centres', data?.medicalCentres],
    ['Diagnostic Centres', data?.centres],
    ['Providers', data?.providers],
    ['Bookings', data?.bookings],
  ] as const;

  return (
    <div>
      <PageHeader title="Search" subtitle={q ? `Results for “${q}”` : 'Type a query in the header.'} />
      {isLoading ? <p className="text-sm text-[var(--muted)]">Searching…</p> : null}
      <div className="space-y-4">
        {groups.map(([label, items]) => (
          <Card key={label}>
            <h2 className="font-medium mb-3">{label}</h2>
            {items?.length ? (
              <ul className="space-y-2 text-sm">
                {items.map((hit) => (
                  <li key={`${hit.kind}-${hit.id}`}>
                    <Link to={LINKS[hit.kind] ?? '/'} className="text-[var(--brand)]">
                      {hit.title}
                    </Link>
                    {hit.subtitle ? <span className="text-[var(--muted)]"> · {hit.subtitle}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">No matches</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
