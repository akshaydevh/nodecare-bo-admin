import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../lib/api';
import { Button, Card, Input, PageHeader, Select, Table } from '../components/ui';

const ENTITIES = [
  'doctors',
  'clinics',
  'hospitals',
  'nurses',
  'specialities',
  'symptoms',
  'lab-tests',
  'lab-packages',
  'pharmacy-categories',
  'pharmacy-products',
] as const;

type Item = { id: string; name?: string; slug?: string; isActive?: boolean; city?: string };

export function CatalogPage() {
  const qc = useQueryClient();
  const [entity, setEntity] = useState<(typeof ENTITIES)[number]>('doctors');
  const [name, setName] = useState('');
  const [city, setCity] = useState('New Delhi');

  const list = useQuery({
    queryKey: ['catalog', entity],
    queryFn: () => apiRequest<{ items: Item[] }>(`/admin/catalog/${entity}`),
  });

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name };
      if (['doctors', 'nurses', 'clinics', 'hospitals'].includes(entity)) {
        body.city = city;
      }
      if (entity === 'clinics' || entity === 'hospitals') {
        body.address = {
          line1: city,
          city,
          state: 'Delhi',
          pincode: '110001',
        };
        body.location = { type: 'Point', coordinates: [77.209, 28.6139] };
      }
      if (entity === 'lab-tests') {
        body.category = 'General';
        body.price = 499;
      }
      if (entity === 'lab-packages') {
        body.price = 1999;
        body.testIds = [];
      }
      if (entity === 'pharmacy-products') {
        body.price = 99;
        body.categoryId = list.data?.items[0]?.id; // may fail if empty — admin can edit later
      }
      return apiRequest(`/admin/catalog/${entity}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setName('');
      void qc.invalidateQueries({ queryKey: ['catalog', entity] });
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/admin/catalog/${entity}/${id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog', entity] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Catalog" subtitle="CRUD for providers, labs, and pharmacy entities." />
      <Select
        value={entity}
        onChange={(e) => setEntity(e.target.value as (typeof ENTITIES)[number])}
        className="max-w-xs"
      >
        {ENTITIES.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </Select>

      <Card>
        <form className="flex flex-wrap gap-3 items-end" onSubmit={onSubmit}>
          <label className="text-sm grow min-w-[200px]">
            <span className="text-[var(--muted)]">Name</span>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          {['doctors', 'nurses', 'clinics', 'hospitals'].includes(entity) ? (
            <label className="text-sm min-w-[160px]">
              <span className="text-[var(--muted)]">City</span>
              <Input className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
          ) : null}
          <Button type="submit" disabled={create.isPending}>
            Create
          </Button>
        </form>
        {create.isError ? (
          <p className="text-sm text-[var(--danger)] mt-2">{(create.error as Error).message}</p>
        ) : null}
      </Card>

      <Table headers={['Name', 'Slug', 'Active', 'Actions']}>
        {(list.data?.items ?? []).map((item) => (
          <tr key={item.id}>
            <td className="px-4 py-3">{item.name || '—'}</td>
            <td className="px-4 py-3 font-mono text-xs">{item.slug || '—'}</td>
            <td className="px-4 py-3">{item.isActive === undefined ? '—' : String(item.isActive)}</td>
            <td className="px-4 py-3">
              {item.isActive !== undefined ? (
                <Button
                  variant="ghost"
                  onClick={() => toggle.mutate({ id: item.id, isActive: !item.isActive })}
                >
                  {item.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              ) : (
                '—'
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
