import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode, type RefObject } from 'react';
import { ApiError, apiRequest, apiUploadBinary, qs } from '../lib/api';
import { PhotoCropModal } from '../components/PhotoCropper';
import { LocationPicker } from '../components/LocationPicker';
import {
  Avatar,
  Button,
  ErrorText,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  Table,
  Textarea,
} from '../components/ui';

type Centre = {
  id: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  licenseNumber: string | null;
  city: string;
  phone: string | null;
  services: string[];
  turnaround: string | null;
  rating: number;
  status: string;
};

type GeoPoint = { type: 'Point'; coordinates: [number, number] };

type CentreAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
};

type CentreDetail = {
  id: string;
  userId: string | null;
  name: string;
  slug: string;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  services: string[];
  turnaround: string | null;
  about: string | null;
  address: CentreAddress | null;
  city: string;
  location: GeoPoint | null;
  rating: number;
  reviewCount: number;
  patientRecommendationPercent: number;
  excellenceRating: number;
  isActive: boolean;
  isFeatured: boolean;
  verificationStatus: string;
  status: string;
  initials: string;
  createdAt: string;
  updatedAt: string;
};

type Page = {
  items: Centre[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  cities?: string[];
};

type CentreForm = {
  name: string;
  phone?: string;
  email?: string;
  slug?: string;
  photoUrl: string;
  licenseNumber: string;
  services: string;
  turnaround: string;
  about: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  lat: string;
  lng: string;
  rating: string;
  reviewCount: string;
  patientRecommendationPercent: string;
  excellenceRating: string;
  isActive: boolean;
  isFeatured: boolean;
  verificationStatus: string;
};

function emptyRegister(): CentreForm {
  return {
    name: '',
    phone: '',
    email: '',
    slug: '',
    photoUrl: '',
    licenseNumber: '',
    services: '',
    turnaround: '',
    about: '',
    line1: '',
    line2: '',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '',
    lat: '',
    lng: '',
    rating: '0',
    reviewCount: '0',
    patientRecommendationPercent: '0',
    excellenceRating: '0',
    isActive: false,
    isFeatured: false,
    verificationStatus: 'pending',
  };
}

function initialsFromName(name: string) {
  const next = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return next || 'DC';
}

function formatCoords(location: GeoPoint | null) {
  if (!location?.coordinates) return '—';
  const [lng, lat] = location.coordinates;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function formatAddress(address: CentreAddress | null) {
  if (!address) return '—';
  return [address.line1, address.line2, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(', ');
}

function parseServices(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function profilePayload(values: CentreForm) {
  return {
    name: values.name,
    slug: values.slug || undefined,
    photoUrl: values.photoUrl.startsWith('http') ? values.photoUrl : undefined,
    phone: values.phone || undefined,
    email: values.email || undefined,
    licenseNumber: values.licenseNumber || undefined,
    services: parseServices(values.services),
    turnaround: values.turnaround || undefined,
    about: values.about || undefined,
    city: values.city,
    address: values.line1
      ? {
          line1: values.line1,
          line2: values.line2 || undefined,
          city: values.city,
          state: values.state || 'Delhi',
          pincode: values.pincode || '110001',
        }
      : undefined,
    location:
      values.lat !== '' && values.lng !== ''
        ? { lat: Number(values.lat), lng: Number(values.lng) }
        : undefined,
    rating: Number(values.rating) || 0,
    reviewCount: Number(values.reviewCount) || 0,
    patientRecommendationPercent: Number(values.patientRecommendationPercent) || 0,
    excellenceRating: Number(values.excellenceRating) || 0,
    isActive: values.isActive,
    isFeatured: values.isFeatured,
    verificationStatus: values.verificationStatus,
  };
}

function toEditForm(c: CentreDetail): CentreForm {
  const [lng, lat] = c.location?.coordinates ?? [];
  return {
    name: c.name,
    slug: c.slug,
    photoUrl: c.photoUrl ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    licenseNumber: c.licenseNumber ?? '',
    services: (c.services ?? []).join(', '),
    turnaround: c.turnaround ?? '',
    about: c.about ?? '',
    line1: c.address?.line1 ?? '',
    line2: c.address?.line2 ?? '',
    city: c.city,
    state: c.address?.state ?? '',
    pincode: c.address?.pincode ?? '',
    lat: lat !== undefined ? String(lat) : '',
    lng: lng !== undefined ? String(lng) : '',
    rating: String(c.rating ?? 0),
    reviewCount: String(c.reviewCount ?? 0),
    patientRecommendationPercent: String(c.patientRecommendationPercent ?? 0),
    excellenceRating: String(c.excellenceRating ?? 0),
    isActive: c.isActive,
    isFeatured: c.isFeatured,
    verificationStatus: c.verificationStatus,
  };
}

function Field({ label, value }: { label: string; value?: string | number | null | boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--ink)] break-words">
        {value === 0 || value === false || value ? String(value) : '—'}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--muted)]">
        {label}
      </div>
      {children}
    </div>
  );
}

function CentreFormFields({
  values,
  onChange,
  initials,
  showPhone = false,
  showSlug = false,
  requirePhone = false,
  fileRef,
  onPickPhoto,
}: {
  values: CentreForm;
  onChange: (patch: Partial<CentreForm>) => void;
  initials: string;
  showPhone?: boolean;
  showSlug?: boolean;
  requirePhone?: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  onPickPhoto: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar initials={initials} src={values.photoUrl || null} className="size-16" />
        <FormField label="Photo">
          <Button type="button" variant="soft" onClick={() => fileRef.current?.click()}>
            {values.photoUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPickPhoto}
          />
        </FormField>
      </div>
      <FormField label="Centre name">
        <Input value={values.name} onChange={(e) => onChange({ name: e.target.value })} required />
      </FormField>
      {showPhone ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Phone">
            <Input
              placeholder="+91 98XXXXXX"
              value={values.phone ?? ''}
              onChange={(e) => onChange({ phone: e.target.value })}
              required={requirePhone}
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              placeholder="optional"
              value={values.email ?? ''}
              onChange={(e) => onChange({ email: e.target.value })}
            />
          </FormField>
        </div>
      ) : null}
      {showSlug ? (
        <FormField label="Slug">
          <Input value={values.slug ?? ''} onChange={(e) => onChange({ slug: e.target.value })} required />
        </FormField>
      ) : null}
      <FormField label="Status">
        <Select
          value={values.verificationStatus}
          onChange={(e) => onChange({ verificationStatus: e.target.value })}
        >
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="suspended">Suspended</option>
        </Select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="License number">
          <Input
            value={values.licenseNumber}
            onChange={(e) => onChange({ licenseNumber: e.target.value })}
          />
        </FormField>
        <FormField label="Turnaround">
          <Input
            placeholder="Same day"
            value={values.turnaround}
            onChange={(e) => onChange({ turnaround: e.target.value })}
          />
        </FormField>
      </div>
      <FormField label="Services">
        <Input
          placeholder="Blood test, X-Ray, MRI"
          value={values.services}
          onChange={(e) => onChange({ services: e.target.value })}
        />
      </FormField>
      <FormField label="Address line 1">
        <Input value={values.line1} onChange={(e) => onChange({ line1: e.target.value })} />
      </FormField>
      <FormField label="Address line 2">
        <Input value={values.line2} onChange={(e) => onChange({ line2: e.target.value })} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="City">
          <Input value={values.city} onChange={(e) => onChange({ city: e.target.value })} required />
        </FormField>
        <FormField label="State">
          <Input value={values.state} onChange={(e) => onChange({ state: e.target.value })} />
        </FormField>
      </div>
      <FormField label="Pincode">
        <Input value={values.pincode} onChange={(e) => onChange({ pincode: e.target.value })} />
      </FormField>
      <FormField label="Location">
        <LocationPicker
          lat={values.lat}
          lng={values.lng}
          onChange={(lat, lng) => onChange({ lat, lng })}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Rating">
          <Input
            type="number"
            min={0}
            max={5}
            step="0.1"
            value={values.rating}
            onChange={(e) => onChange({ rating: e.target.value })}
          />
        </FormField>
        <FormField label="Reviews">
          <Input
            type="number"
            min={0}
            value={values.reviewCount}
            onChange={(e) => onChange({ reviewCount: e.target.value })}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Patient recommendation %">
          <Input
            type="number"
            min={0}
            max={100}
            value={values.patientRecommendationPercent}
            onChange={(e) => onChange({ patientRecommendationPercent: e.target.value })}
          />
        </FormField>
        <FormField label="Excellence rating">
          <Input
            type="number"
            min={0}
            max={5}
            step="0.1"
            value={values.excellenceRating}
            onChange={(e) => onChange({ excellenceRating: e.target.value })}
          />
        </FormField>
      </div>
      <FormField label="About">
        <Textarea value={values.about} onChange={(e) => onChange({ about: e.target.value })} />
      </FormField>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => onChange({ isActive: e.target.checked })}
          />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isFeatured}
            onChange={(e) => onChange({ isFeatured: e.target.checked })}
          />
          Featured on home
        </label>
      </div>
    </>
  );
}

export function CentresPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState(() => emptyRegister());
  const [error, setError] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [edit, setEdit] = useState<CentreForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [photoTarget, setPhotoTarget] = useState<'register' | 'edit'>('edit');
  const fileRef = useRef<HTMLInputElement>(null);
  const registerFileRef = useRef<HTMLInputElement>(null);

  const list = useQuery({
    queryKey: ['network-centres', q, status, city, page],
    queryFn: () =>
      apiRequest<Page>(`/admin/network/centres${qs({ q, status, city, page, limit: 10 })}`),
  });

  const detail = useQuery({
    queryKey: ['network-centre', viewId],
    queryFn: () => apiRequest<CentreDetail>(`/admin/network/centres/${viewId}`),
    enabled: Boolean(viewId),
  });

  useEffect(() => {
    if (mode === 'edit' && detail.data && !edit) {
      setEdit(toEditForm(detail.data));
    }
  }, [mode, detail.data, edit]);

  const create = useMutation({
    mutationFn: () =>
      apiRequest('/admin/network/centres', {
        method: 'POST',
        body: JSON.stringify({
          ...profilePayload(form),
          phone: form.phone,
          email: form.email || undefined,
        }),
      }),
    onSuccess: () => {
      setRegisterOpen(false);
      setForm(emptyRegister());
      void qc.invalidateQueries({ queryKey: ['network-centres'] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const update = useMutation({
    mutationFn: () => {
      if (!viewId || !edit) throw new Error('Nothing to save');
      return apiRequest<CentreDetail>(`/admin/network/centres/${viewId}`, {
        method: 'PATCH',
        body: JSON.stringify(profilePayload(edit)),
      });
    },
    onSuccess: () => {
      setMode('view');
      setDetailError('');
      void qc.invalidateQueries({ queryKey: ['network-centres'] });
      void qc.invalidateQueries({ queryKey: ['network-centre', viewId] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => setDetailError(err.message),
  });

  const remove = useMutation({
    mutationFn: () => apiRequest(`/admin/network/centres/${viewId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setViewId(null);
      setConfirmDelete(false);
      setMode('view');
      void qc.invalidateQueries({ queryKey: ['network-centres'] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => {
      const message =
        err instanceof ApiError && err.code === 'CENTRE_HAS_OPEN_BOOKINGS'
          ? 'This centre has open diagnostic bookings and cannot be deleted.'
          : err.message;
      setDetailError(message);
    },
  });

  const uploadPhoto = useMutation({
    mutationFn: async (blob: Blob) => {
      if (photoTarget === 'register') {
        const data = await apiUploadBinary<{ publicUrl: string; key: string }>(
          '/admin/network/centres/photo',
          blob,
          'image/jpeg',
        );
        return { kind: 'register' as const, data };
      }
      if (!viewId) throw new Error('Centre is not loaded yet');
      const data = await apiUploadBinary<CentreDetail>(
        `/admin/network/centres/${viewId}/photo`,
        blob,
        'image/jpeg',
      );
      return { kind: 'edit' as const, data };
    },
    onSuccess: (result) => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      if (result.kind === 'register') {
        setForm((current) => ({ ...current, photoUrl: result.data.publicUrl }));
        return;
      }
      setEdit((current) => (current ? { ...current, photoUrl: result.data.photoUrl ?? '' } : current));
      qc.setQueryData(['network-centre', viewId], result.data);
      void qc.invalidateQueries({ queryKey: ['network-centres'] });
    },
    onError: (err: Error) => {
      if (photoTarget === 'register') setError(err.message);
      else setDetailError(err.message);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    create.mutate();
  }

  function closeRegister() {
    setRegisterOpen(false);
    setForm(emptyRegister());
    setError('');
    if (photoTarget === 'register' && cropSrc) {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  }

  function closeDetail() {
    setViewId(null);
    setMode('view');
    setEdit(null);
    setConfirmDelete(false);
    setDetailError('');
    if (photoTarget === 'edit' && cropSrc) {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  }

  function onPickPhoto(target: 'register' | 'edit', e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const setMsg = target === 'register' ? setError : setDetailError;
    if (!file.type.startsWith('image/')) {
      setMsg('Choose a JPEG, PNG, or WebP image');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setMsg('Photo must be 12 MB or smaller before cropping');
      return;
    }
    setMsg('');
    setPhotoTarget(target);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
  }

  const data = list.data;
  const centre = detail.data;
  const cities = data?.cities ?? [];

  return (
    <div>
      <PageHeader
        eyebrow={`Network • ${data?.total ?? 0} centres`}
        title="Diagnostic Centres"
        subtitle="Manage lab and imaging partners offering diagnostic bookings on the platform."
        action={
          <Button
            onClick={() => {
              setForm(emptyRegister());
              setError('');
              setRegisterOpen(true);
            }}
          >
            + Register centre
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search by centre name or license no."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="max-w-xs"
        />
        <Select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="max-w-[180px]"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="suspended">Suspended</option>
        </Select>
        <Select
          value={city}
          onChange={(e) => {
            setPage(1);
            setCity(e.target.value);
          }}
          className="max-w-[160px]"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <Table headers={['Centre', 'City', 'License', 'Services', 'Status', '']}>
        {(data?.items ?? []).map((c) => (
          <tr key={c.id} className="hover:bg-[#f8fafb]">
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                <Avatar initials={c.initials} src={c.photoUrl} className="size-9 text-xs" />
                <div className="font-semibold text-[var(--ink)]">{c.name}</div>
              </div>
            </td>
            <td className="px-4 py-3.5">{c.city || '—'}</td>
            <td className="px-4 py-3.5">{c.licenseNumber || '—'}</td>
            <td className="px-4 py-3.5">{c.services?.length ? c.services.join(', ') : '—'}</td>
            <td className="px-4 py-3.5">
              <StatusPill status={c.status} />
            </td>
            <td className="px-4 py-3.5 text-right">
              <button
                type="button"
                className="text-sm font-medium text-[var(--brand)] hover:underline"
                onClick={() => {
                  setMode('view');
                  setConfirmDelete(false);
                  setDetailError('');
                  setViewId(c.id);
                }}
              >
                View
              </button>
            </td>
          </tr>
        ))}
      </Table>
      {data ? (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={data.limit}
          onPage={setPage}
        />
      ) : null}

      <Modal open={registerOpen} size="lg" title="Register diagnostic centre" onClose={closeRegister}>
        <form className="space-y-3" onSubmit={onSubmit}>
          <CentreFormFields
            values={form}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            initials={initialsFromName(form.name)}
            showPhone
            requirePhone
            fileRef={registerFileRef}
            onPickPhoto={(e) => onPickPhoto('register', e)}
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Register'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewId)}
        size="lg"
        title={mode === 'edit' ? 'Edit diagnostic centre' : centre?.name || 'Diagnostic centre'}
        onClose={closeDetail}
      >
        {!centre && viewId ? (
          <p className="text-sm text-[var(--muted)]">Loading centre profile…</p>
        ) : null}

        {centre && mode === 'view' ? (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <Avatar initials={centre.initials} src={centre.photoUrl} className="size-20 text-lg" />
              <div className="min-w-0">
                <div className="text-xl font-semibold">{centre.name}</div>
                <div className="text-sm text-[var(--muted)] mt-0.5">
                  {centre.city || 'Diagnostic centre'}
                  {centre.phone ? ` • ${centre.phone}` : ''}
                </div>
                <div className="mt-2">
                  <StatusPill status={centre.verificationStatus} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Slug" value={centre.slug} />
              <Field label="User ID" value={centre.userId} />
              <Field label="Phone" value={centre.phone} />
              <Field label="Email" value={centre.email} />
              <Field label="License" value={centre.licenseNumber} />
              <Field label="Services" value={centre.services?.join(', ')} />
              <Field label="Turnaround" value={centre.turnaround} />
              <Field label="City" value={centre.city} />
              <Field label="Address" value={formatAddress(centre.address)} />
              <Field label="Rating" value={centre.rating ? `${centre.rating.toFixed(1)} ★` : '—'} />
              <Field label="Reviews" value={centre.reviewCount} />
              <Field label="Patient recommendation" value={`${centre.patientRecommendationPercent}%`} />
              <Field label="Excellence" value={centre.excellenceRating} />
              <Field label="Location" value={formatCoords(centre.location)} />
              <Field label="Active" value={centre.isActive ? 'Yes' : 'No'} />
              <Field label="Featured" value={centre.isFeatured ? 'Yes' : 'No'} />
              <Field label="Status" value={centre.verificationStatus} />
              <Field label="Created" value={new Date(centre.createdAt).toLocaleString('en-IN')} />
              <Field label="Updated" value={new Date(centre.updatedAt).toLocaleString('en-IN')} />
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--muted)]">About</div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{centre.about || '—'}</p>
            </div>

            <ErrorText>{detailError}</ErrorText>

            {confirmDelete ? (
              <div className="rounded-lg border border-[#fecdca] bg-[#fef3f2] p-3">
                <p className="text-sm text-[#b42318]">
                  Delete {centre.name} from the network? This cannot be undone from the console.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
                    {remove.isPending ? 'Deleting…' : 'Confirm delete'}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  onClick={() => {
                    setEdit(toEditForm(centre));
                    setMode('edit');
                    setDetailError('');
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setConfirmDelete(true);
                    setDetailError('');
                  }}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {centre && mode === 'edit' && edit ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setDetailError('');
              update.mutate();
            }}
          >
            <CentreFormFields
              values={edit}
              onChange={(patch) => setEdit((current) => (current ? { ...current, ...patch } : current))}
              initials={centre.initials}
              showPhone
              showSlug
              fileRef={fileRef}
              onPickPhoto={(e) => onPickPhoto('edit', e)}
            />
            <ErrorText>{detailError}</ErrorText>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMode('view');
                  setDetailError('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <PhotoCropModal
        open={Boolean(cropSrc)}
        src={cropSrc}
        busy={uploadPhoto.isPending}
        onClose={() => {
          if (cropSrc) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
        }}
        onConfirm={(blob) => uploadPhoto.mutate(blob)}
      />
    </div>
  );
}
