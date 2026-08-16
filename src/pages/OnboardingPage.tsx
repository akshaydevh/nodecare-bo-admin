import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../lib/api';
import { Button, Card, ErrorText, Input, PageHeader, Select, Table } from '../components/ui';

type Row = {
  id: string;
  status: string;
  role: string;
  providerEntityId: string;
  user: { name?: string | null; phone: string } | null;
};

export function OnboardingPage() {
  const qc = useQueryClient();
  const [role, setRole] = useState('doctor');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('New Delhi');
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => apiRequest<{ items: Row[] }>('/admin/onboarding'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiRequest('/admin/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          role,
          phone,
          name,
          entity: { city },
          status: 'active',
        }),
      }),
    onSuccess: () => {
      setPhone('');
      setName('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['onboarding'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Provider Access"
        subtitle="Invite and link provider identities; verify access, suspend, or reactivate."
      />
      <Card>
        <form className="grid md:grid-cols-2 gap-3" onSubmit={onSubmit}>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Role</span>
            <Select className="mt-1" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="doctor">doctor</option>
              <option value="nurse">nurse</option>
              <option value="clinic_admin">clinic_admin</option>
              <option value="diagnostics_admin">diagnostics_admin</option>
              <option value="pharmacy_admin">pharmacy_admin</option>
            </Select>
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Phone</span>
            <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Name</span>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">City</span>
            <Input className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <div className="md:col-span-2">
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create provider'}
            </Button>
          </div>
        </form>
      </Card>

      <Table headers={['Name', 'Phone', 'Role', 'Status', 'Entity']}>
        {(list.data?.items ?? []).map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3">{row.user?.name || '—'}</td>
            <td className="px-4 py-3">{row.user?.phone || '—'}</td>
            <td className="px-4 py-3">{row.role}</td>
            <td className="px-4 py-3">{row.status}</td>
            <td className="px-4 py-3 font-mono text-xs">{row.providerEntityId}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
