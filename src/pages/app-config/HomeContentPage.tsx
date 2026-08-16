import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CmsImageCropModal, CMS_CROP_PRESETS } from '../../components/CmsImageCropper';
import { Button, Card, ErrorText, Input, PageHeader, Select, Table } from '../../components/ui';
import { apiRequest, apiUploadBinary } from '../../lib/api';
import {
  destinationLabel,
  publicationStatus,
  type CarouselSlide,
  type CmsDestination,
  type FeaturedCard,
  type ServiceShortcut,
} from '../../lib/cms-types';

type Tab = 'carousel' | 'shortcuts' | 'featured';

const SCREEN_OPTIONS = [
  { value: 'book_appointment', label: 'Book appointment' },
  { value: 'ambulance', label: 'Ambulance' },
  { value: 'caretaker', label: 'Caretaker' },
  { value: 'diagnostics', label: 'Diagnostics' },
  { value: 'pharmacy', label: 'Pharmacy' },
] as const;

function DestinationFields({
  value,
  onChange,
}: {
  value: CmsDestination;
  onChange: (d: CmsDestination) => void;
}) {
  const type = value.type;
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Select
        value={type}
        onChange={(e) => {
          const t = e.target.value as CmsDestination['type'];
          if (t === 'none') onChange({ type: 'none' });
          else if (t === 'screen') onChange({ type: 'screen', value: 'book_appointment' });
          else if (t === 'external_url') onChange({ type: 'external_url', url: 'https://' });
          else onChange({ type: t, id: '' });
        }}
      >
        <option value="none">None</option>
        <option value="screen">App screen</option>
        <option value="doctor">Doctor</option>
        <option value="speciality">Speciality</option>
        <option value="lab_package">Lab package</option>
        <option value="pharmacy_category">Pharmacy category</option>
        <option value="external_url">External HTTPS URL</option>
      </Select>
      {type === 'screen' ? (
        <Select
          value={value.value}
          onChange={(e) =>
            onChange({ type: 'screen', value: e.target.value as typeof SCREEN_OPTIONS[number]['value'] })
          }
        >
          {SCREEN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : null}
      {type === 'doctor' ||
      type === 'speciality' ||
      type === 'lab_package' ||
      type === 'pharmacy_category' ? (
        <Input
          placeholder="Entity ObjectId"
          value={value.id}
          onChange={(e) => onChange({ type, id: e.target.value })}
          required
        />
      ) : null}
      {type === 'external_url' ? (
        <Input
          placeholder="https://…"
          value={value.url}
          onChange={(e) => onChange({ type: 'external_url', url: e.target.value })}
          required
        />
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === 'Live'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'Scheduled'
        ? 'bg-amber-100 text-amber-800'
        : status === 'Expired' || status === 'Disabled'
          ? 'bg-slate-200 text-slate-700'
          : 'bg-sky-100 text-sky-800';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>
  );
}

export function HomeContentPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('carousel');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropPreset, setCropPreset] = useState<keyof typeof CMS_CROP_PRESETS>('carousel');
  const [pendingImage, setPendingImage] = useState<{ publicUrl: string; key: string } | null>(null);

  const [slideForm, setSlideForm] = useState({
    title: '',
    subtitle: '',
    altText: '',
    destination: { type: 'none' } as CmsDestination,
    isActive: true,
    publishAt: '',
    unpublishAt: '',
  });
  const [editSlideId, setEditSlideId] = useState<string | null>(null);

  const [cardForm, setCardForm] = useState({
    headline: '',
    caption: '',
    altText: '',
    destination: { type: 'screen', value: 'book_appointment' } as CmsDestination,
    backgroundStart: '#135246',
    backgroundEnd: '#1a6b5c',
    isActive: true,
    publishAt: '',
    unpublishAt: '',
  });
  const [editCardId, setEditCardId] = useState<string | null>(null);

  const slides = useQuery({
    queryKey: ['cms-carousel'],
    queryFn: () => apiRequest<CarouselSlide[]>('/admin/cms/carousel'),
  });
  const cards = useQuery({
    queryKey: ['cms-featured'],
    queryFn: () => apiRequest<FeaturedCard[]>('/admin/cms/featured-cards'),
  });
  const shortcuts = useQuery({
    queryKey: ['cms-shortcuts'],
    queryFn: () => apiRequest<ServiceShortcut[]>('/admin/cms/service-shortcuts'),
  });

  const uploadMedia = useMutation({
    mutationFn: (blob: Blob) =>
      apiUploadBinary<{ publicUrl: string; key: string }>(
        `/admin/cms/media?preset=${cropPreset}`,
        blob,
        'image/jpeg',
      ),
    onSuccess: (data) => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      setPendingImage(data);
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveSlide = useMutation({
    mutationFn: async () => {
      if (!pendingImage?.publicUrl && !editSlideId) throw new Error('Upload an image first');
      const body = {
        title: slideForm.title,
        subtitle: slideForm.subtitle || null,
        altText: slideForm.altText || null,
        destination: slideForm.destination,
        isActive: slideForm.isActive,
        publishAt: slideForm.publishAt ? new Date(slideForm.publishAt).toISOString() : null,
        unpublishAt: slideForm.unpublishAt ? new Date(slideForm.unpublishAt).toISOString() : null,
        ...(pendingImage
          ? { imageUrl: pendingImage.publicUrl, imageKey: pendingImage.key }
          : {}),
        sortOrder: 0,
      };
      if (editSlideId) {
        return apiRequest(`/admin/cms/carousel/${editSlideId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      return apiRequest('/admin/cms/carousel', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setSlideForm({
        title: '',
        subtitle: '',
        altText: '',
        destination: { type: 'none' },
        isActive: true,
        publishAt: '',
        unpublishAt: '',
      });
      setPendingImage(null);
      setEditSlideId(null);
      setError('');
      void qc.invalidateQueries({ queryKey: ['cms-carousel'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveCard = useMutation({
    mutationFn: async () => {
      if (!pendingImage?.publicUrl && !editCardId) throw new Error('Upload an image first');
      const body = {
        headline: cardForm.headline,
        caption: cardForm.caption || null,
        altText: cardForm.altText || null,
        destination: cardForm.destination,
        backgroundStart: cardForm.backgroundStart || null,
        backgroundEnd: cardForm.backgroundEnd || null,
        isActive: cardForm.isActive,
        publishAt: cardForm.publishAt ? new Date(cardForm.publishAt).toISOString() : null,
        unpublishAt: cardForm.unpublishAt ? new Date(cardForm.unpublishAt).toISOString() : null,
        ...(pendingImage
          ? { imageUrl: pendingImage.publicUrl, imageKey: pendingImage.key }
          : {}),
        sortOrder: 0,
      };
      if (editCardId) {
        return apiRequest(`/admin/cms/featured-cards/${editCardId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      return apiRequest('/admin/cms/featured-cards', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setCardForm({
        headline: '',
        caption: '',
        altText: '',
        destination: { type: 'screen', value: 'book_appointment' },
        backgroundStart: '#135246',
        backgroundEnd: '#1a6b5c',
        isActive: true,
        publishAt: '',
        unpublishAt: '',
      });
      setPendingImage(null);
      setEditCardId(null);
      setError('');
      void qc.invalidateQueries({ queryKey: ['cms-featured'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteSlide = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/cms/carousel/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cms-carousel'] }),
  });
  const deleteCard = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/cms/featured-cards/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cms-featured'] }),
  });

  const toggleSlide = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/admin/cms/carousel/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cms-carousel'] }),
  });
  const toggleCard = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/admin/cms/featured-cards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cms-featured'] }),
  });

  const updateShortcut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ServiceShortcut> }) =>
      apiRequest(`/admin/cms/service-shortcuts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cms-shortcuts'] }),
    onError: (err: Error) => setError(err.message),
  });

  const reorder = useMutation({
    mutationFn: async ({
      kind,
      orderedIds,
    }: {
      kind: 'carousel' | 'featured-cards' | 'service-shortcuts';
      orderedIds: string[];
    }) =>
      apiRequest(`/admin/cms/${kind}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ orderedIds }),
      }),
    onSuccess: (_d, vars) => {
      const key =
        vars.kind === 'carousel'
          ? 'cms-carousel'
          : vars.kind === 'featured-cards'
            ? 'cms-featured'
            : 'cms-shortcuts';
      void qc.invalidateQueries({ queryKey: [key] });
    },
  });

  function pickImage(preset: keyof typeof CMS_CROP_PRESETS) {
    setCropPreset(preset);
    fileRef.current?.click();
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose a JPEG, PNG, or WebP image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Source image must be 5 MB or smaller');
      return;
    }
    setError('');
    setCropSrc(URL.createObjectURL(file));
  }

  function moveItem<T extends { id: string }>(
    items: T[],
    id: string,
    dir: -1 | 1,
    kind: 'carousel' | 'featured-cards' | 'service-shortcuts',
  ) {
    const idx = items.findIndex((i) => i.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= items.length) return;
    const ordered = [...items];
    const [row] = ordered.splice(idx, 1);
    ordered.splice(next, 0, row);
    reorder.mutate({ kind, orderedIds: ordered.map((i) => i.id) });
  }

  function onSlideSubmit(e: FormEvent) {
    e.preventDefault();
    saveSlide.mutate();
  }

  function onCardSubmit(e: FormEvent) {
    e.preventDefault();
    saveCard.mutate();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'carousel', label: 'Carousel' },
    { id: 'shortcuts', label: 'Service Shortcuts' },
    { id: 'featured', label: 'Featured Cards' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Home Content"
        subtitle="Carousel, service shortcuts, and featured cards published to the patient home."
      />
      <p className="text-sm text-[var(--muted)]">
        Changes may take up to a few minutes to appear on patient devices after cache expiry.
      </p>

      <div className="flex gap-2 border-b border-[var(--line)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setPendingImage(null);
              setError('');
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id
                ? 'border-[var(--brand)] text-[var(--brand)]'
                : 'border-transparent text-[var(--muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <CmsImageCropModal
        open={Boolean(cropSrc)}
        src={cropSrc}
        presetKey={cropPreset}
        busy={uploadMedia.isPending}
        onClose={() => {
          if (cropSrc) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
        }}
        onConfirm={(blob) => uploadMedia.mutate(blob)}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}

      {tab === 'carousel' ? (
        <div className="space-y-4">
          <Card>
            <form className="space-y-3" onSubmit={onSlideSubmit}>
              <div className="grid md:grid-cols-2 gap-3">
                <Input
                  placeholder="Title"
                  value={slideForm.title}
                  onChange={(e) => setSlideForm((s) => ({ ...s, title: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Subtitle"
                  value={slideForm.subtitle}
                  onChange={(e) => setSlideForm((s) => ({ ...s, subtitle: e.target.value }))}
                />
                <Input
                  placeholder="Alt text"
                  value={slideForm.altText}
                  onChange={(e) => setSlideForm((s) => ({ ...s, altText: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={slideForm.isActive}
                    onChange={(e) => setSlideForm((s) => ({ ...s, isActive: e.target.checked }))}
                  />
                  Active
                </label>
                <Input
                  type="datetime-local"
                  value={slideForm.publishAt}
                  onChange={(e) => setSlideForm((s) => ({ ...s, publishAt: e.target.value }))}
                />
                <Input
                  type="datetime-local"
                  value={slideForm.unpublishAt}
                  onChange={(e) => setSlideForm((s) => ({ ...s, unpublishAt: e.target.value }))}
                />
              </div>
              <DestinationFields
                value={slideForm.destination}
                onChange={(destination) => setSlideForm((s) => ({ ...s, destination }))}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="ghost" onClick={() => pickImage('carousel')}>
                  Upload / crop image
                </Button>
                {pendingImage ? (
                  <img src={pendingImage.publicUrl} alt="" className="h-12 rounded object-cover" />
                ) : null}
                <Button type="submit" disabled={saveSlide.isPending}>
                  {editSlideId ? 'Save slide' : 'Create slide'}
                </Button>
                {editSlideId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditSlideId(null);
                      setPendingImage(null);
                    }}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
          <Table headers={['Preview', 'Title', 'Destination', 'Status', 'Order', 'Actions']}>
            {(slides.data ?? []).map((s, i, arr) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <img src={s.imageUrl} alt="" className="h-10 w-16 rounded object-cover" />
                </td>
                <td className="px-4 py-3">{s.title}</td>
                <td className="px-4 py-3 text-sm">{destinationLabel(s.destination)}</td>
                <td className="px-4 py-3">
                  <StatusPill status={publicationStatus(s)} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => moveItem(arr, s.id, -1, 'carousel')}
                      disabled={i === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => moveItem(arr, s.id, 1, 'carousel')}
                      disabled={i === arr.length - 1}
                    >
                      ↓
                    </Button>
                  </div>
                </td>
                <td className="px-4 py-3 space-x-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditSlideId(s.id);
                      setSlideForm({
                        title: s.title,
                        subtitle: s.subtitle ?? '',
                        altText: s.altText ?? '',
                        destination: s.destination ?? { type: 'none' },
                        isActive: s.isActive,
                        publishAt: s.publishAt ? s.publishAt.slice(0, 16) : '',
                        unpublishAt: s.unpublishAt ? s.unpublishAt.slice(0, 16) : '',
                      });
                      setPendingImage(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => toggleSlide.mutate({ id: s.id, isActive: !s.isActive })}
                  >
                    {s.isActive ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="danger" onClick={() => deleteSlide.mutate(s.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      ) : null}

      {tab === 'featured' ? (
        <div className="space-y-4">
          <Card>
            <form className="space-y-3" onSubmit={onCardSubmit}>
              <div className="grid md:grid-cols-2 gap-3">
                <Input
                  placeholder="Headline"
                  value={cardForm.headline}
                  onChange={(e) => setCardForm((s) => ({ ...s, headline: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Caption"
                  value={cardForm.caption}
                  onChange={(e) => setCardForm((s) => ({ ...s, caption: e.target.value }))}
                />
                <Input
                  placeholder="Alt text"
                  value={cardForm.altText}
                  onChange={(e) => setCardForm((s) => ({ ...s, altText: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cardForm.isActive}
                    onChange={(e) => setCardForm((s) => ({ ...s, isActive: e.target.checked }))}
                  />
                  Active
                </label>
                <Input
                  type="color"
                  value={cardForm.backgroundStart}
                  onChange={(e) => setCardForm((s) => ({ ...s, backgroundStart: e.target.value }))}
                />
                <Input
                  type="color"
                  value={cardForm.backgroundEnd}
                  onChange={(e) => setCardForm((s) => ({ ...s, backgroundEnd: e.target.value }))}
                />
                <Input
                  type="datetime-local"
                  value={cardForm.publishAt}
                  onChange={(e) => setCardForm((s) => ({ ...s, publishAt: e.target.value }))}
                />
                <Input
                  type="datetime-local"
                  value={cardForm.unpublishAt}
                  onChange={(e) => setCardForm((s) => ({ ...s, unpublishAt: e.target.value }))}
                />
              </div>
              <DestinationFields
                value={cardForm.destination}
                onChange={(destination) => setCardForm((s) => ({ ...s, destination }))}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="ghost" onClick={() => pickImage('featured_card')}>
                  Upload / crop image
                </Button>
                {pendingImage ? (
                  <img src={pendingImage.publicUrl} alt="" className="h-16 w-12 rounded object-cover" />
                ) : null}
                <div
                  className="h-20 w-14 rounded-lg p-2 text-[10px] text-white"
                  style={{
                    background: `linear-gradient(160deg, ${cardForm.backgroundStart}, ${cardForm.backgroundEnd})`,
                  }}
                >
                  Preview
                </div>
                <Button type="submit" disabled={saveCard.isPending}>
                  {editCardId ? 'Save card' : 'Create card'}
                </Button>
              </div>
            </form>
          </Card>
          <Table headers={['Preview', 'Headline', 'Destination', 'Status', 'Order', 'Actions']}>
            {(cards.data ?? []).map((c, i, arr) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <img src={c.imageUrl} alt="" className="h-14 w-10 rounded object-cover" />
                </td>
                <td className="px-4 py-3">{c.headline}</td>
                <td className="px-4 py-3 text-sm">{destinationLabel(c.destination)}</td>
                <td className="px-4 py-3">
                  <StatusPill status={publicationStatus(c)} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => moveItem(arr, c.id, -1, 'featured-cards')}
                      disabled={i === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => moveItem(arr, c.id, 1, 'featured-cards')}
                      disabled={i === arr.length - 1}
                    >
                      ↓
                    </Button>
                  </div>
                </td>
                <td className="px-4 py-3 space-x-2">
                  <Button
                    variant="ghost"
                    onClick={() => toggleCard.mutate({ id: c.id, isActive: !c.isActive })}
                  >
                    {c.isActive ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="danger" onClick={() => deleteCard.mutate(c.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      ) : null}

      {tab === 'shortcuts' ? (
        <div className="space-y-4">
          <Table headers={['Key', 'Title', 'Availability', 'Variant', 'Order', 'Actions']}>
            {(shortcuts.data ?? []).map((s, i, arr) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-mono text-xs">{s.serviceKey}</td>
                <td className="px-4 py-3">
                  <Input
                    defaultValue={s.title}
                    onBlur={(e) => {
                      if (e.target.value !== s.title) {
                        updateShortcut.mutate({ id: s.id, patch: { title: e.target.value } });
                      }
                    }}
                  />
                  <Input
                    className="mt-1"
                    defaultValue={s.subtitle ?? ''}
                    placeholder="Subtitle"
                    onBlur={(e) => {
                      if (e.target.value !== (s.subtitle ?? '')) {
                        updateShortcut.mutate({ id: s.id, patch: { subtitle: e.target.value } });
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={s.availability}
                    onChange={(e) =>
                      updateShortcut.mutate({
                        id: s.id,
                        patch: {
                          availability: e.target.value as ServiceShortcut['availability'],
                        },
                      })
                    }
                  >
                    <option value="available">Available</option>
                    <option value="coming_soon">Coming soon</option>
                    <option value="hidden">Hidden</option>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={s.displayVariant}
                    onChange={(e) =>
                      updateShortcut.mutate({
                        id: s.id,
                        patch: {
                          displayVariant: e.target.value as ServiceShortcut['displayVariant'],
                        },
                      })
                    }
                  >
                    <option value="half">Half</option>
                    <option value="wide">Wide</option>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => moveItem(arr, s.id, -1, 'service-shortcuts')}
                      disabled={i === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => moveItem(arr, s.id, 1, 'service-shortcuts')}
                      disabled={i === arr.length - 1}
                    >
                      ↓
                    </Button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      pickImage(s.displayVariant === 'wide' ? 'service_shortcut_wide' : 'service_shortcut')
                    }
                  >
                    Image
                  </Button>
                  {pendingImage && cropPreset.startsWith('service_shortcut') ? (
                    <Button
                      type="button"
                      className="ml-2"
                      onClick={() =>
                        updateShortcut.mutate({
                          id: s.id,
                          patch: {
                            imageUrl: pendingImage.publicUrl,
                            imageKey: pendingImage.key,
                          } as Partial<ServiceShortcut>,
                        })
                      }
                    >
                      Apply upload
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      ) : null}
    </div>
  );
}
