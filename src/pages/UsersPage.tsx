import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest, type AdminUser } from '../lib/api';
import { Button, Input, PageHeader, Select, Table } from '../components/ui';

type Page = {
  items: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
};

export function UsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', q, role],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (role) params.set('role', role);
      return apiRequest<Page>(`/admin/users?${params.toString()}`);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, accountStatus }: { id: string; accountStatus: string }) =>
      apiRequest(`/admin/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ accountStatus }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return (
    <div>
      <PageHeader title="Users" subtitle="Search patients and provider accounts." />
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search phone, name, email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select value={role} onChange={(e) => setRole(e.target.value)} className="max-w-[200px]">
          <option value="">All roles</option>
          <option value="patient">patient</option>
          <option value="doctor">doctor</option>
          <option value="nurse">nurse</option>
          <option value="clinic_admin">clinic_admin</option>
          <option value="diagnostics_admin">diagnostics_admin</option>
          <option value="pharmacy_admin">pharmacy_admin</option>
          <option value="root">root</option>
          <option value="support">support</option>
        </Select>
      </div>
      {isLoading ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}
      <Table headers={['Name', 'Phone', 'Role', 'Status', 'Actions']}>
        {(data?.items ?? []).map((u) => (
          <tr key={u.id}>
            <td className="px-4 py-3">{u.name || u.username || '—'}</td>
            <td className="px-4 py-3">{u.phone}</td>
            <td className="px-4 py-3">{u.role}</td>
            <td className="px-4 py-3">{u.accountStatus}</td>
            <td className="px-4 py-3 space-x-2">
              <Button
                variant="ghost"
                onClick={() =>
                  statusMutation.mutate({
                    id: u.id,
                    accountStatus: u.accountStatus === 'active' ? 'suspended' : 'active',
                  })
                }
              >
                {u.accountStatus === 'active' ? 'Suspend' : 'Activate'}
              </Button>
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-[var(--muted)] mt-3">
        {data ? `${data.total} users · page ${data.page}/${data.totalPages}` : null}
      </p>
    </div>
  );
}
