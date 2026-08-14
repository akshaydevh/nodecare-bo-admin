import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Card, ErrorText, Input, PageHeader, Textarea } from '../components/ui';

type Settings = {
  company: {
    companyName: string;
    supportEmail: string;
    supportPhone: string;
    registeredAddress: string;
  };
  commissions: {
    doctor: number;
    diagnostics: number;
    pharmacy: number;
    ambulance: number;
    caretaker: number;
  };
};

export function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isRoot = user?.role === 'root';
  const { data } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => apiRequest<Settings>('/admin/settings'),
  });
  const [company, setCompany] = useState(data?.company);
  const [commissions, setCommissions] = useState(data?.commissions);
  const [editingRates, setEditingRates] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (data) {
      setCompany(data.company);
      setCommissions(data.commissions);
    }
  }, [data]);

  const saveCompany = useMutation({
    mutationFn: () =>
      apiRequest('/admin/settings/company', {
        method: 'PATCH',
        body: JSON.stringify(company),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-settings'] }),
    onError: (err: Error) => setError(err.message),
  });

  const saveRates = useMutation({
    mutationFn: () =>
      apiRequest('/admin/settings/commissions', {
        method: 'PATCH',
        body: JSON.stringify(commissions),
      }),
    onSuccess: () => {
      setEditingRates(false);
      void qc.invalidateQueries({ queryKey: ['platform-settings'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  function onCompany(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (company) saveCompany.mutate();
  }

  const rates = [
    ['doctor', 'Doctor consultation'],
    ['diagnostics', 'Diagnostic services'],
    ['pharmacy', 'Pharmacy orders'],
    ['ambulance', 'Ambulance booking'],
    ['caretaker', 'Caretaker services'],
  ] as const;

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        subtitle="Company profile, commission rules and platform preferences."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="font-medium mb-4">Company profile</h2>
          {company ? (
            <form className="space-y-3" onSubmit={onCompany}>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Company name</span>
                <Input
                  className="mt-1"
                  value={company.companyName}
                  onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                  disabled={!isRoot}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Support email</span>
                <Input
                  className="mt-1"
                  type="email"
                  value={company.supportEmail}
                  onChange={(e) => setCompany({ ...company, supportEmail: e.target.value })}
                  disabled={!isRoot}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Support phone</span>
                <Input
                  className="mt-1"
                  value={company.supportPhone}
                  onChange={(e) => setCompany({ ...company, supportPhone: e.target.value })}
                  disabled={!isRoot}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Registered address</span>
                <Textarea
                  className="mt-1"
                  value={company.registeredAddress}
                  onChange={(e) => setCompany({ ...company, registeredAddress: e.target.value })}
                  disabled={!isRoot}
                />
              </label>
              <ErrorText>{error}</ErrorText>
              {isRoot ? (
                <Button type="submit" disabled={saveCompany.isPending}>
                  Save changes
                </Button>
              ) : (
                <p className="text-xs text-[var(--muted)]">Only Super Admin can edit company profile.</p>
              )}
            </form>
          ) : null}
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium">Commission rates</h2>
            {isRoot && !editingRates ? (
              <Button variant="ghost" onClick={() => setEditingRates(true)}>
                Edit commission rules
              </Button>
            ) : null}
          </div>
          <ul className="space-y-3 text-sm">
            {rates.map(([key, label]) => (
              <li key={key} className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                <span>{label}</span>
                {editingRates && commissions ? (
                  <Input
                    type="number"
                    className="w-20"
                    min={0}
                    max={50}
                    value={commissions[key]}
                    onChange={(e) =>
                      setCommissions({ ...commissions, [key]: Number(e.target.value) })
                    }
                  />
                ) : (
                  <strong>{commissions?.[key] ?? '—'}%</strong>
                )}
              </li>
            ))}
          </ul>
          {editingRates ? (
            <Button className="mt-4" onClick={() => saveRates.mutate()} disabled={saveRates.isPending}>
              Save rates
            </Button>
          ) : null}
        </Card>
      </div>
      <p className="text-sm text-[var(--muted)] mt-6">
        Signed in as <strong>{user?.username || user?.email}</strong> ({user?.role}).{' '}
        <Link to="/cms" className="text-[var(--brand)]">
          Manage CMS
        </Link>
      </p>
    </div>
  );
}
