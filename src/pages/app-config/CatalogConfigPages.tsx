import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button, Card, ErrorText, Input, PageHeader, Table } from '../../components/ui';
import { apiRequest } from '../../lib/api';

type Row = Record<string, unknown> & { id: string };

export function CatalogEntityPage({
  title,
  subtitle,
  entity,
  fields,
}: {
  title: string;
  subtitle: string;
  entity: string;
  fields: { key: string; label: string; type?: string; required?: boolean }[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['catalog', entity],
    queryFn: () => apiRequest<{ items: Row[] }>(`/admin/catalog/${entity}?limit=100`),
  });

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const f of fields) {
        const raw = form[f.key] ?? '';
        if (f.type === 'number') body[f.key] = raw === '' ? undefined : Number(raw);
        else if (f.type === 'boolean') body[f.key] = raw === 'true';
        else body[f.key] = raw || undefined;
      }
      return apiRequest(`/admin/catalog/${entity}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setForm({});
      setError('');
      void qc.invalidateQueries({ queryKey: ['catalog', entity] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/admin/catalog/${entity}/${id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['catalog', entity] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Card>
        <form className="grid md:grid-cols-2 gap-3" onSubmit={onSubmit}>
          {fields.map((f) =>
            f.type === 'boolean' ? (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form[f.key] === 'true'}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, [f.key]: e.target.checked ? 'true' : 'false' }))
                  }
                />
                {f.label}
              </label>
            ) : (
              <Input
                key={f.key}
                type={f.type === 'number' ? 'number' : 'text'}
                placeholder={f.label}
                value={form[f.key] ?? ''}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                required={f.required}
              />
            ),
          )}
          <Button type="submit">Create</Button>
        </form>
      </Card>
      <Table headers={[...fields.map((f) => f.label), 'Actions']}>
        {(list.data?.items ?? []).map((row) => (
          <tr key={row.id}>
            {fields.map((f) => (
              <td key={f.key} className="px-4 py-3 max-w-[200px] truncate">
                {String(row[f.key] ?? '—')}
              </td>
            ))}
            <td className="px-4 py-3">
              {'isActive' in row ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    setActive.mutate({ id: row.id, isActive: !(row.isActive as boolean) })
                  }
                >
                  {row.isActive ? 'Disable' : 'Enable'}
                </Button>
              ) : null}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function DiscoveryConfigPage() {
  const [sub, setSub] = useState<'specialities' | 'symptoms'>('specialities');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={sub === 'specialities' ? undefined : 'ghost'} onClick={() => setSub('specialities')}>
          Specialties
        </Button>
        <Button variant={sub === 'symptoms' ? undefined : 'ghost'} onClick={() => setSub('symptoms')}>
          Symptoms
        </Button>
      </div>
      {sub === 'specialities' ? (
        <CatalogEntityPage
          title="Discovery — Specialties"
          subtitle="Icons, popularity, and order for patient discovery."
          entity="specialities"
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'description', label: 'Description' },
            { key: 'iconUrl', label: 'Icon URL' },
            { key: 'isPopular', label: 'Popular', type: 'boolean' },
            { key: 'sortOrder', label: 'Sort order', type: 'number' },
          ]}
        />
      ) : (
        <CatalogEntityPage
          title="Discovery — Symptoms"
          subtitle="Symptoms linked to specialties."
          entity="symptoms"
          fields={[{ key: 'name', label: 'Name', required: true }]}
        />
      )}
    </div>
  );
}

export function DiagnosticsConfigPage() {
  const [sub, setSub] = useState<'lab-tests' | 'lab-packages'>('lab-tests');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={sub === 'lab-tests' ? undefined : 'ghost'} onClick={() => setSub('lab-tests')}>
          Lab tests
        </Button>
        <Button variant={sub === 'lab-packages' ? undefined : 'ghost'} onClick={() => setSub('lab-packages')}>
          Packages
        </Button>
      </div>
      {sub === 'lab-tests' ? (
        <CatalogEntityPage
          title="Diagnostics — Lab tests"
          subtitle="Manage lab test catalog."
          entity="lab-tests"
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'category', label: 'Category' },
            { key: 'price', label: 'Price', type: 'number' },
            { key: 'sampleType', label: 'Sample type' },
            { key: 'turnaroundHours', label: 'Turnaround (h)', type: 'number' },
            { key: 'isPopular', label: 'Popular', type: 'boolean' },
          ]}
        />
      ) : (
        <CatalogEntityPage
          title="Diagnostics — Packages"
          subtitle="Health packages."
          entity="lab-packages"
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'price', label: 'Price', type: 'number' },
            { key: 'discountedPrice', label: 'Discounted price', type: 'number' },
            { key: 'isPopular', label: 'Popular', type: 'boolean' },
          ]}
        />
      )}
    </div>
  );
}

export function PharmacyConfigPage() {
  const [sub, setSub] = useState<'pharmacy-categories' | 'pharmacy-products'>('pharmacy-categories');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={sub === 'pharmacy-categories' ? undefined : 'ghost'}
          onClick={() => setSub('pharmacy-categories')}
        >
          Categories
        </Button>
        <Button
          variant={sub === 'pharmacy-products' ? undefined : 'ghost'}
          onClick={() => setSub('pharmacy-products')}
        >
          Products
        </Button>
      </div>
      {sub === 'pharmacy-categories' ? (
        <CatalogEntityPage
          title="Pharmacy — Categories"
          subtitle="Category images and order."
          entity="pharmacy-categories"
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'imageUrl', label: 'Image URL' },
            { key: 'sortOrder', label: 'Sort order', type: 'number' },
          ]}
        />
      ) : (
        <CatalogEntityPage
          title="Pharmacy — Products"
          subtitle="Products and prescription flags."
          entity="pharmacy-products"
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'categoryId', label: 'Category ID', required: true },
            { key: 'price', label: 'Price', type: 'number' },
            { key: 'mrp', label: 'MRP', type: 'number' },
            { key: 'requiresPrescription', label: 'Rx required', type: 'boolean' },
          ]}
        />
      )}
    </div>
  );
}

export function TestimonialsConfigPage() {
  return (
    <CatalogEntityPage
      title="Testimonials"
      subtitle="Patient testimonials shown across the app."
      entity="testimonials"
      fields={[
        { key: 'authorName', label: 'Author', required: true },
        { key: 'comment', label: 'Comment', required: true },
        { key: 'authorPhotoUrl', label: 'Photo URL' },
        { key: 'timeAgoLabel', label: 'Time label' },
        { key: 'sortOrder', label: 'Sort order', type: 'number' },
        { key: 'isActive', label: 'Active', type: 'boolean' },
      ]}
    />
  );
}
