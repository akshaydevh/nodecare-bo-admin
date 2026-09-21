import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { apiRequest, qs } from '../lib/api';
import { Button, Card, ErrorText, Input, PageHeader, Select, Table } from '../components/ui';

type Row = {
  id: string;
  status: string;
  role: string;
  providerEntityId: string;
  user: { name?: string | null; phone: string } | null;
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

export function OnboardingPage() {
  const qc = useQueryClient();
  const [role, setRole] = useState('doctor');
  const [nameQuery, setNameQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(nameQuery.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [nameQuery]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const list = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => apiRequest<{ items: Row[] }>('/admin/onboarding'),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Provider Access"
        subtitle="Grant app login to an existing doctor, caretaker, clinic, hospital, lab, or pharmacy. Phone and city come from that profile."
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
