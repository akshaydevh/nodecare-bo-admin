import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconUsers } from '../../components/icons';
import {
  Button,
  EmptyState,
  ErrorText,
  Input,
  Pagination,
  Select,
  SkeletonRows,
  StatusPill,
  Table,
  TableMessage,
} from '../../components/ui';
import { apiRequest, qs, type AdminUser } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDate, relativeTime, titleCase } from '../../lib/format';
import type { StatusTarget } from './AccountStatusDialog';

type Account = AdminUser & { lastLoginAt?: string | null };
type Page = { items: Account[]; total: number; page: number; totalPages: number; limit: number };

const BACK_OFFICE = new Set(['root', 'admin', 'support', 'finance']);

const ROLE_OPTIONS = [
  ['patient', 'Patient'],
  ['doctor', 'Doctor'],
  ['nurse', 'Caretaker'],
  ['clinic_admin', 'Clinic / hospital admin'],
  ['diagnostics_admin', 'Diagnostics admin'],
  ['pharmacy_admin', 'Pharmacy admin'],
  ['support', 'Support (team)'],
  ['finance', 'Finance (team)'],
  ['root', 'Super admin (team)'],
] as const;

const HEADERS = ['Account', 'Phone', 'Role', 'Status', 'Last sign-in', 'Joined', ''];

/** Every login on the platform (patients and provider accounts), from /admin/users. */
export function AccountsTable({ canWrite, onStatus }: { canWrite: boolean; onStatus: (a: StatusTarget) => void }) {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ['admin-users', q, role, status, page],
    queryFn: () =>
      apiRequest<Page>(`/admin/users${qs({ q: q.trim(), role, accountStatus: status, page, limit: 15 })}`),
    placeholderData: keepPreviousData,
  });
  const data = list.data;

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          aria-label="Search accounts"
          placeholder="Search phone, name, email or username"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="max-w-xs"
        />
        <Select
          aria-label="Filter by role"
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value);
          }}
          className="max-w-[220px]"
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
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
            <EmptyState icon={<IconUsers className="size-5" />} title="No accounts match" />
          </TableMessage>
        ) : (
          (data?.items ?? []).map((u) => {
            const name = u.name || u.username || 'Unnamed';
            const team = BACK_OFFICE.has(u.role);
            return (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{name}</div>
                  <div className="text-xs text-[var(--muted)]">{u.email ?? ''}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{u.phone.startsWith('deleted:') ? '—' : u.phone}</td>
                <td className="px-4 py-3">{titleCase(u.role === 'nurse' ? 'caretaker' : u.role)}</td>
                <td className="px-4 py-3">
                  <StatusPill status={u.accountStatus} />
                </td>
                <td className="px-4 py-3 text-[var(--muted)] whitespace-nowrap">
                  {u.lastLoginAt ? relativeTime(u.lastLoginAt) : 'Never'}
                </td>
                <td className="px-4 py-3 text-[var(--muted)] whitespace-nowrap">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  {u.id === user?.id ? (
                    <span className="text-xs text-[var(--muted)]">You</span>
                  ) : team ? (
                    <Link to="/team" className="text-sm text-[var(--brand)]">
                      Manage in Team
                    </Link>
                  ) : canWrite && u.accountStatus !== 'deleted' ? (
                    <Button
                      variant={u.accountStatus === 'active' ? 'danger' : 'soft'}
                      className="px-2.5 py-1.5"
                      onClick={() => onStatus({ id: u.id, name, accountStatus: u.accountStatus })}
                    >
                      {u.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })
        )}
      </Table>
      {data && data.total > 0 ? (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={setPage} />
      ) : null}
    </>
  );
}
