import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconUser } from '../components/icons';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorText,
  Input,
  PageHeader,
  Pagination,
  Select,
  SkeletonRows,
  StatusPill,
  Table,
  TableMessage,
  Tabs,
} from '../components/ui';
import { apiRequest, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { monthYear } from '../lib/format';
import { can } from '../lib/roles';
import { AccountStatusDialog, type StatusTarget } from './patients/AccountStatusDialog';
import { AccountsTable } from './patients/AccountsTable';

type Patient = {
  id: string;
  name: string;
  initials: string;
  phoneMasked: string;
  city: string | null;
  registeredAt: string;
  bookings: number;
  accountStatus: 'active' | 'suspended' | 'deleted';
};

type Page = { items: Patient[]; total: number; page: number; totalPages: number; limit: number };

const HEADERS = ['Patient', 'Phone', 'City', 'Registered', 'Bookings', 'Status', ''];

function PatientsTable({ canWrite, onStatus }: { canWrite: boolean; onStatus: (a: StatusTarget) => void }) {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ['ops-patients', q, city, status, page],
    queryFn: () =>
      apiRequest<Page>(`/admin/patients${qs({ q: q.trim(), city: city.trim(), accountStatus: status, page, limit: 10 })}`),
    placeholderData: keepPreviousData,
  });
  const data = list.data;

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          aria-label="Search patients"
          placeholder="Search by name or phone number"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="max-w-xs"
        />
        <Input
          aria-label="Filter by city"
          placeholder="All cities"
          value={city}
          onChange={(e) => {
            setPage(1);
            setCity(e.target.value);
          }}
          className="max-w-[160px]"
        />
        <Select
          aria-label="Filter by account status"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="max-w-[170px]"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
        </Select>
      </div>
      {list.isError ? <ErrorText>{(list.error as Error).message}</ErrorText> : null}
      <Table headers={HEADERS}>
        {list.isLoading ? (
          <TableMessage colSpan={HEADERS.length}>
            <SkeletonRows rows={6} className="h-10" />
          </TableMessage>
        ) : data && data.items.length === 0 ? (
          <TableMessage colSpan={HEADERS.length}>
            <EmptyState
              icon={<IconUser className="size-5" />}
              title="No patients match"
              body="Try a different name, phone number or city."
            />
          </TableMessage>
        ) : (
          (data?.items ?? []).map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Avatar initials={p.initials} />
                  <span className="font-medium">{p.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{p.phoneMasked}</td>
              <td className="px-4 py-3">{p.city || '—'}</td>
              <td className="px-4 py-3">{monthYear(p.registeredAt)}</td>
              <td className="px-4 py-3 tabular-nums">{p.bookings}</td>
              <td className="px-4 py-3">
                <StatusPill status={p.accountStatus} />
              </td>
              <td className="px-4 py-3 text-right">
                {canWrite && p.accountStatus !== 'deleted' ? (
                  <Button
                    variant={p.accountStatus === 'active' ? 'danger' : 'soft'}
                    className="px-2.5 py-1.5"
                    onClick={() => onStatus({ id: p.id, name: p.name, accountStatus: p.accountStatus })}
                  >
                    {p.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))
        )}
      </Table>
      {data && data.total > 0 ? (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={setPage} />
      ) : null}
    </>
  );
}

export function PatientsPage() {
  const { user } = useAuth();
  const canWrite = can(user?.role, 'userStatus');
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'accounts' ? 'accounts' : 'patients';
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Users"
        title="Patients"
        subtitle="People using the NOD Care patient app. Suspending an account signs it out everywhere immediately."
      />
      <div className="mb-4">
        <Tabs
          value={view}
          onChange={(id) => setParams(id === 'accounts' ? { view: 'accounts' } : {})}
          items={[
            { id: 'patients', label: 'Patients' },
            { id: 'accounts', label: 'All app accounts' },
          ]}
        />
      </div>
      {view === 'patients' ? (
        <PatientsTable canWrite={canWrite} onStatus={setStatusTarget} />
      ) : (
        <AccountsTable canWrite={canWrite} onStatus={setStatusTarget} />
      )}
      <AccountStatusDialog account={statusTarget} onClose={() => setStatusTarget(null)} />
    </div>
  );
}
