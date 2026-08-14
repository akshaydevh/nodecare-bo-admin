import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest, qs } from '../lib/api';
import { monthYear } from '../lib/format';
import { Avatar, Input, PageHeader, Pagination, Select, Table } from '../components/ui';

type Patient = {
  id: string;
  name: string;
  initials: string;
  phoneMasked: string;
  city: string | null;
  registeredAt: string;
  bookings: number;
};

type Page = { items: Patient[]; total: number; page: number; totalPages: number; limit: number };

export function PatientsPage() {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ['ops-patients', q, city, page],
    queryFn: () => apiRequest<Page>(`/admin/patients${qs({ q, city, page, limit: 10 })}`),
  });

  const data = list.data;

  return (
    <div>
      <PageHeader
        eyebrow="Users"
        title="Patients"
        subtitle="People using the NOD Care patient app to book services."
      />
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search by name or phone number"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="max-w-xs"
        />
        <Input
          placeholder="All cities"
          value={city}
          onChange={(e) => {
            setPage(1);
            setCity(e.target.value);
          }}
          className="max-w-[160px]"
        />
        <Select defaultValue="" className="max-w-[160px]" disabled>
          <option value="">All statuses</option>
        </Select>
      </div>
      <Table headers={['Patient', 'Phone', 'City', 'Registered', 'Bookings']}>
        {(data?.items ?? []).map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Avatar initials={p.initials} />
                <span className="font-medium">{p.name}</span>
              </div>
            </td>
            <td className="px-4 py-3">{p.phoneMasked}</td>
            <td className="px-4 py-3">{p.city || '—'}</td>
            <td className="px-4 py-3">{monthYear(p.registeredAt)}</td>
            <td className="px-4 py-3">{p.bookings}</td>
          </tr>
        ))}
      </Table>
      {data ? (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={data.limit}
          onPage={setPage}
        />
      ) : null}
    </div>
  );
}
