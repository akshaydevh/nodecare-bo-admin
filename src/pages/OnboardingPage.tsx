import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { apiRequest, qs } from '../lib/api';
import { Button, Card, ErrorText, Input, PageHeader, Pagination, Select, Table } from '../components/ui';

type Row = {
  id: string;
  status: string;
  role: string;
  providerEntityType: string;
  providerEntityId: string;
  user: { name?: string | null; phone: string } | null;
  createdAt?: string;
};

type Page = {
  items: Row[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
};

type Candidate = {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  kind: string;
  alreadyLinked: boolean;
};

const ROLES = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Caretaker / Nurse' },
  { value: 'clinic_admin', label: 'Clinic / Hospital admin' },
  { value: 'diagnostics_admin', label: 'Diagnostics admin' },
  { value: 'pharmacy_admin', label: 'Pharmacy admin' },
] as const;

const ROLE_LABEL: Record<string, string> = {
  doctor: 'Doctor',
  nurse: 'Caretaker',
  clinic_admin: 'Clinic / Hospital',
  diagnostics_admin: 'Diagnostics',
  pharmacy_admin: 'Pharmacy',
};

const TYPE_LABEL: Record<string, string> = {
  doctor: 'Doctor',
  nurse: 'Caretaker',
  clinic: 'Clinic',
  hospital: 'Hospital',
  lab_facility: 'Diagnostics',
  pharmacy_store: 'Pharmacy',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'draft', label: 'Draft' },
  { value: 'suspended', label: 'Suspended' },
];

export function OnboardingPage() {
  const qc = useQueryClient();
  const [role, setRole] = useState('doctor');
  const [nameQuery, setNameQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tableQ, setTableQ] = useState('');
  const [debouncedTableQ, setDebouncedTableQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(nameQuery.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [nameQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedTableQ(tableQ.trim());
      setPage(1);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [tableQ]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const list = useQuery({
    queryKey: ['onboarding', debouncedTableQ, statusFilter, roleFilter, page],
    queryFn: () =>
      apiRequest<Page>(
        `/admin/onboarding${qs({
          q: debouncedTableQ || undefined,
          status: statusFilter || undefined,
          role: roleFilter || undefined,
          page,
          limit: 10,
        })}`,
      ),
  });

  const candidates = useQuery({
    queryKey: ['onboarding-candidates', role, debouncedQuery],
    queryFn: () =>
      apiRequest<{ items: Candidate[] }>(
        `/admin/onboarding/candidates${qs({ role, q: debouncedQuery || undefined, limit: 20 })}`,
      ),
  });

  const options = useMemo(
    () => (candidates.data?.items ?? []).filter((item) => !item.alreadyLinked),
    [candidates.data],
  );

  const create = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select a profile by name');
      return apiRequest('/admin/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          role,
          entityId: selected.id,
          status: 'active',
        }),
      });
    },
    onSuccess: () => {
      setSelected(null);
      setNameQuery('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['onboarding'] });
      void qc.invalidateQueries({ queryKey: ['onboarding-candidates'] });
      void qc.invalidateQueries({ queryKey: ['ops-dashboard'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/onboarding/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setConfirmId(null);
      setError('');
      void qc.invalidateQueries({ queryKey: ['onboarding'] });
      void qc.invalidateQueries({ queryKey: ['onboarding-candidates'] });
      void qc.invalidateQueries({ queryKey: ['ops-dashboard'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  function onRoleChange(next: string) {
    setRole(next);
    setSelected(null);
    setNameQuery('');
    setError('');
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError('Select a profile from the name list');
      return;
    }
    create.mutate();
  }

  const rows = list.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Provider Access"
        subtitle="Grant app login to an existing doctor, caretaker, clinic, hospital, lab, or pharmacy. Only profiles with access can be booked."
      />
      <Card>
        <form className="grid md:grid-cols-2 gap-3" onSubmit={onSubmit}>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Role</span>
            <Select className="mt-1" value={role} onChange={(e) => onRoleChange(e.target.value)}>
              {ROLES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
          <div className="text-sm" ref={boxRef}>
            <span className="text-[var(--muted)]">Name</span>
            <div className="relative mt-1">
              <Input
                value={selected ? selected.name : nameQuery}
                onChange={(e) => {
                  setSelected(null);
                  setNameQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                placeholder="Search by name"
                autoComplete="off"
                required={!selected}
              />
              {open ? (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[var(--line)] bg-white shadow-[var(--shadow)]">
                  {candidates.isFetching ? (
                    <div className="px-3 py-2 text-sm text-[var(--muted)]">Searching…</div>
                  ) : options.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[var(--muted)]">
                      No unmatched profiles. Create the catalog record first.
                    </div>
                  ) : (
                    options.map((item) => (
                      <button
                        key={`${item.kind}-${item.id}`}
                        type="button"
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-[var(--brand-soft)]"
                        onClick={() => {
                          setSelected(item);
                          setNameQuery(item.name);
                          setOpen(false);
                          setError('');
                        }}
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {item.kind}
                          {item.phone ? ` · ${item.phone}` : ' · no phone'}
                          {item.city ? ` · ${item.city}` : ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
          {selected ? (
            <>
              <label className="text-sm">
                <span className="text-[var(--muted)]">Phone</span>
                <Input className="mt-1" value={selected.phone ?? 'Missing on profile'} readOnly />
              </label>
              <label className="text-sm">
                <span className="text-[var(--muted)]">City</span>
                <Input className="mt-1" value={selected.city ?? '—'} readOnly />
              </label>
            </>
          ) : null}
          <div className="md:col-span-2">
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={create.isPending || !selected || !selected.phone}>
              {create.isPending ? 'Granting…' : 'Grant access'}
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name or phone"
          value={tableQ}
          onChange={(e) => setTableQ(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[220px]"
        >
          <option value="">All roles</option>
          {ROLES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[180px]"
        >
          {STATUS_OPTIONS.map((item) => (
            <option key={item.value || 'all'} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>

      <Table headers={['Name', 'Phone', 'Role', 'Type', 'Status', 'Actions']}>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
              {list.isFetching ? 'Loading…' : 'No provider access records.'}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">{row.user?.name || '—'}</td>
              <td className="px-4 py-3">{row.user?.phone || '—'}</td>
              <td className="px-4 py-3">{ROLE_LABEL[row.role] ?? row.role}</td>
              <td className="px-4 py-3">{TYPE_LABEL[row.providerEntityType] ?? row.providerEntityType}</td>
              <td className="px-4 py-3 capitalize">{row.status.replace('_', ' ')}</td>
              <td className="px-4 py-3 text-right">
                {confirmId === row.id ? (
                  <div className="inline-flex items-center gap-2">
                    <Button
                      variant="danger"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(row.id)}
                    >
                      {revoke.isPending && revoke.variables === row.id ? 'Revoking…' : 'Confirm'}
                    </Button>
                    <Button variant="ghost" disabled={revoke.isPending} onClick={() => setConfirmId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="danger" onClick={() => setConfirmId(row.id)}>
                    Delete
                  </Button>
                )}
              </td>
            </tr>
          ))
        )}
      </Table>
      {list.data ? (
        <Pagination
          page={list.data.page}
          totalPages={list.data.totalPages}
          total={list.data.total}
          limit={list.data.limit}
          onPage={setPage}
        />
      ) : null}
    </div>
  );
}
