import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, ErrorText, Input, PageHeader } from '../../components/ui';
import { apiRequest } from '../../lib/api';

type SupportConfig = {
  whatsapp?: string | null;
  email?: string | null;
  phone?: string | null;
  faqUrl?: string | null;
  hours?: string | null;
  channels: {
    whatsapp: boolean;
    email: boolean;
    phone: boolean;
    faq: boolean;
  };
};

export function SupportConfigPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<SupportConfig>({
    whatsapp: '',
    email: '',
    phone: '',
    faqUrl: '',
    hours: '24x7',
    channels: { whatsapp: true, email: true, phone: true, faq: true },
  });
  const [error, setError] = useState('');

  const query = useQuery({
    queryKey: ['patient-support'],
    queryFn: () => apiRequest<SupportConfig>('/admin/settings/patient-support'),
  });

  useEffect(() => {
    if (query.data) {
      setForm({
        whatsapp: query.data.whatsapp ?? '',
        email: query.data.email ?? '',
        phone: query.data.phone ?? '',
        faqUrl: query.data.faqUrl ?? '',
        hours: query.data.hours ?? '24x7',
        channels: {
          whatsapp: query.data.channels?.whatsapp ?? true,
          email: query.data.channels?.email ?? true,
          phone: query.data.channels?.phone ?? true,
          faq: query.data.channels?.faq ?? true,
        },
      });
    }
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest('/admin/settings/patient-support', {
        method: 'PATCH',
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      setError('');
      void qc.invalidateQueries({ queryKey: ['patient-support'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Support & Service Flags"
        subtitle="Contacts and channel visibility for the patient Customer Service screen."
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Card>
        <form className="grid md:grid-cols-2 gap-3" onSubmit={onSubmit}>
          <Input
            placeholder="WhatsApp number"
            value={form.whatsapp ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, whatsapp: e.target.value }))}
          />
          <Input
            placeholder="Support email"
            value={form.email ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
          />
          <Input
            placeholder="Support phone"
            value={form.phone ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
          />
          <Input
            placeholder="FAQ URL (https)"
            value={form.faqUrl ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, faqUrl: e.target.value }))}
          />
          <Input
            placeholder="Hours label"
            value={form.hours ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, hours: e.target.value }))}
          />
          {(
            [
              ['whatsapp', 'WhatsApp'],
              ['email', 'Email'],
              ['phone', 'Phone'],
              ['faq', 'FAQ'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.channels[key]}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    channels: { ...s.channels, [key]: e.target.checked },
                  }))
                }
              />
              Enable {label}
            </label>
          ))}
          <Button type="submit" disabled={save.isPending}>
            Save support config
          </Button>
        </form>
      </Card>
    </div>
  );
}
