import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  Avatar,
  Button,
  ErrorText,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusDot,
  Table,
} from '../components/ui';

type Member = {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  role: string;
  roleLabel: string;
  region: string;
  status: string;
};

export function TeamPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canWrite = user?.role === 'root';
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'support',
    region: 'All regions',
  });

  const list = useQuery({
    queryKey: ['admin-team'],
    queryFn: () => apiRequest<{ items: Member[] }>('/admin/team'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiRequest<{ temporaryPassword: string }>('/admin/team', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: (data) => {
      setTempPassword(data.temporaryPassword);
      void qc.invalidateQueries({ queryKey: ['admin-team'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setTempPassword('');
    create.mutate();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Team & Roles"
        subtitle="Manage company representatives and what each of them can access."
        action={
          canWrite ? <Button onClick={() => setOpen(true)}>+ Add team member</Button> : undefined
        }
      />
      <Table headers={['Name', 'Email', 'Role', 'Region', 'Status']}>
        {(list.data?.items ?? []).map((m) => (
          <tr key={m.id}>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Avatar initials={m.initials} />
                <span className="font-medium">{m.name}</span>
              </div>
            </td>
            <td className="px-4 py-3">{m.email || '—'}</td>
            <td className="px-4 py-3">{m.roleLabel}</td>
            <td className="px-4 py-3">{m.region}</td>
            <td className="px-4 py-3">
              <StatusDot status={m.status} />
            </td>
          </tr>
        ))}
      </Table>

      <Modal
        open={open}
        title="Add team member"
        onClose={() => {
          setOpen(false);
          setTempPassword('');
        }}
      >
        <form className="space-y-3" onSubmit={onSubmit}>
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="admin">Ops Manager</option>
            <option value="support">Support</option>
            <option value="finance">Finance</option>
          </Select>
          <Input placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          <ErrorText>{error}</ErrorText>
          {tempPassword ? (
            <p className="text-sm bg-[var(--brand-soft)] rounded-lg p-3">
              One-time password (shown once): <strong>{tempPassword}</strong>
            </p>
          ) : null}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Inviting…' : 'Add member'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
