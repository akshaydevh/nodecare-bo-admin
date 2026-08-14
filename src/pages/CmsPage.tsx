import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../lib/api';
import { Button, Card, Input, PageHeader, Table } from '../components/ui';

type Slide = { id: string; title: string; imageUrl: string; isActive: boolean; sortOrder: number };
type Tab = { id: string; label: string; deepLink?: string | null; isActive: boolean };

export function CmsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('https://example.com/banner.jpg');
  const [label, setLabel] = useState('');
  const [deepLink, setDeepLink] = useState('nodcare://home');

  const slides = useQuery({
    queryKey: ['cms-carousel'],
    queryFn: () => apiRequest<Slide[]>('/admin/cms/carousel'),
  });
  const tabs = useQuery({
    queryKey: ['cms-tabs'],
    queryFn: () => apiRequest<Tab[]>('/admin/cms/feature-tabs'),
  });

  const createSlide = useMutation({
    mutationFn: () =>
      apiRequest('/admin/cms/carousel', {
        method: 'POST',
        body: JSON.stringify({ title, imageUrl, isActive: true, sortOrder: 0 }),
      }),
    onSuccess: () => {
      setTitle('');
      void qc.invalidateQueries({ queryKey: ['cms-carousel'] });
    },
  });

  const createTab = useMutation({
    mutationFn: () =>
      apiRequest('/admin/cms/feature-tabs', {
        method: 'POST',
        body: JSON.stringify({ label, deepLink, isActive: true }),
      }),
    onSuccess: () => {
      setLabel('');
      void qc.invalidateQueries({ queryKey: ['cms-tabs'] });
    },
  });

  const deleteSlide = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/admin/cms/carousel/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-carousel'] }),
  });

  const deleteTab = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/admin/cms/feature-tabs/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-tabs'] }),
  });

  function onSlide(e: FormEvent) {
    e.preventDefault();
    createSlide.mutate();
  }

  function onTab(e: FormEvent) {
    e.preventDefault();
    createTab.mutate();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="CMS"
        subtitle="Carousel and feature tabs published to patient home."
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Carousel</h2>
        <Card>
          <form className="grid md:grid-cols-2 gap-3" onSubmit={onSlide}>
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input
              placeholder="Image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              required
            />
            <Button type="submit">Add slide</Button>
          </form>
        </Card>
        <Table headers={['Title', 'Image', 'Active', 'Actions']}>
          {(slides.data ?? []).map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-3">{s.title}</td>
              <td className="px-4 py-3 truncate max-w-[240px]">{s.imageUrl}</td>
              <td className="px-4 py-3">{String(s.isActive)}</td>
              <td className="px-4 py-3">
                <Button variant="danger" onClick={() => deleteSlide.mutate(s.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Feature tabs</h2>
        <Card>
          <form className="grid md:grid-cols-2 gap-3" onSubmit={onTab}>
            <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} required />
            <Input
              placeholder="Deep link"
              value={deepLink}
              onChange={(e) => setDeepLink(e.target.value)}
            />
            <Button type="submit">Add tab</Button>
          </form>
        </Card>
        <Table headers={['Label', 'Deep link', 'Active', 'Actions']}>
          {(tabs.data ?? []).map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-3">{t.label}</td>
              <td className="px-4 py-3">{t.deepLink || '—'}</td>
              <td className="px-4 py-3">{String(t.isActive)}</td>
              <td className="px-4 py-3">
                <Button variant="danger" onClick={() => deleteTab.mutate(t.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
