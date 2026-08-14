import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode, type RefObject } from 'react';
import { ApiError, apiRequest, apiUploadBinary, qs } from '../lib/api';
import { formatInr } from '../lib/format';
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
  StatusDot,
  StatusPill,
  Table,
  Tabs,
  Textarea,
} from '../components/ui';

type ProviderKind = 'ambulance' | 'pharmacy' | 'caretaker';
type GeoPoint = { type: 'Point'; coordinates: [number, number] };

type ProviderRow = {
  id: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  city?: string | null;
  phone?: string | null;
  verificationStatus: string;
  status?: string;
  fleetId?: string;
  vehicleNumber?: string;
  type?: string;
  driverName?: string | null;
  zone?: string | null;
  liveStatus?: string;
  licenseNumber?: string | null;
  services?: string[];
  hourlyRate?: number;
};

type AmbulanceDetail = {
  id: string;
  name: string;
  initials: string;
  fleetId: string;
  vehicleNumber: string;
  type: string;
  ambulanceType: string;
  driverName: string | null;
  phone: string | null;
  zone: string | null;
  city: string | null;
  photoUrl: string | null;
  location: GeoPoint | null;
  liveStatus: string;
  isActive: boolean;
  verificationStatus: string;
  createdAt: string;
  updatedAt: string;
};

type PharmacyDetail = {
  id: string;
  userId: string | null;
  name: string;
  initials: string;
  slug: string;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  about: string | null;
  city: string;
  location: GeoPoint | null;
  isActive: boolean;
  verificationStatus: string;
  createdAt: string;
  updatedAt: string;
};

type CaretakerDetail = {
  id: string;
  userId: string | null;
  name: string;
  initials: string;
  slug: string;
  photoUrl: string | null;
  gender: 'male' | 'female' | 'other' | null;
  qualifications: string[];
  experienceYears: number;
  about: string | null;
  services: string[];
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  patientRecommendationPercent: number;
  city: string;
  location: GeoPoint | null;
  isActive: boolean;
  verificationStatus: string;
  createdAt: string;
  updatedAt: string;
};

type ProviderDetail = AmbulanceDetail | PharmacyDetail | CaretakerDetail;
type Page = { items: ProviderRow[]; total: number; page: number; totalPages: number; limit: number };

type AmbulanceForm = {
  name: string;
  vehicleNumber: string;
  ambulanceType: string;
  driverName: string;
  phone: string;
  zone: string;
  city: string;
  photoUrl: string;
  lat: string;
  lng: string;
  isActive: boolean;
  verificationStatus: string;
};

type PharmacyForm = {
  name: string;
  phone: string;
  email: string;
  city: string;
  slug: string;
  licenseNumber: string;
  photoUrl: string;
  about: string;
  lat: string;
  lng: string;
  isActive: boolean;
  verificationStatus: string;
};

type CaretakerForm = {
  name: string;
  phone: string;
  email: string;
  city: string;
  slug: string;
  photoUrl: string;
  gender: string;
  qualifications: string;
  experienceYears: string;
  about: string;
  services: string;
  hourlyRate: string;
  rating: string;
  reviewCount: string;
  patientRecommendationPercent: string;
  lat: string;
  lng: string;
  isActive: boolean;
  verificationStatus: string;
};

function emptyAmbulance(): AmbulanceForm {
  return {
    name: '',
    vehicleNumber: '',
    ambulanceType: 'basic',
    driverName: '',
    phone: '',
    zone: '',
    city: 'New Delhi',
    photoUrl: '',
    lat: '',
    lng: '',
    isActive: false,
    verificationStatus: 'pending',
  };
}

function emptyPharmacy(): PharmacyForm {
  return {
    name: '',
    phone: '',
    email: '',
    city: 'New Delhi',
    slug: '',
    licenseNumber: '',
    photoUrl: '',
    about: '',
    lat: '',
    lng: '',
    isActive: false,
    verificationStatus: 'pending',
  };
}

function emptyCaretaker(): CaretakerForm {
  return {
    name: '',
    phone: '',
    email: '',
    city: 'New Delhi',
    slug: '',
    photoUrl: '',
    gender: 'female',
    qualifications: '',
    experienceYears: '3',
    about: '',
    services: '',
    hourlyRate: '350',
    rating: '0',
    reviewCount: '0',
    patientRecommendationPercent: '0',
    lat: '',
    lng: '',
    isActive: false,
    verificationStatus: 'pending',
  };
}

function parseList(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function coords(location: GeoPoint | null) {
  if (!location?.coordinates) return { lat: '', lng: '' };
  const [lng, lat] = location.coordinates;
  return { lat: String(lat), lng: String(lng) };
}

function formatCoords(location: GeoPoint | null) {
  if (!location?.coordinates) return '—';
  const [lng, lat] = location.coordinates;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function locationPayload(lat: string, lng: string) {
  if (lat === '' || lng === '') return undefined;
  return { lat: Number(lat), lng: Number(lng) };
}

function initialsFromName(name: string) {
  const next = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return next || 'SP';
}

function noun(type: ProviderKind) {
  if (type === 'ambulance') return 'ambulance';
  if (type === 'pharmacy') return 'pharmacy';
  return 'caretaker';
}

function toAmbulanceForm(d: AmbulanceDetail): AmbulanceForm {
  const { lat, lng } = coords(d.location);
  return {
    name: d.name,
    vehicleNumber: d.vehicleNumber,
    ambulanceType: d.ambulanceType || d.type,
    driverName: d.driverName ?? '',
    phone: d.phone ?? '',
    zone: d.zone ?? '',
    city: d.city ?? '',
    photoUrl: d.photoUrl ?? '',
    lat,
    lng,
    isActive: d.isActive,
    verificationStatus: d.verificationStatus,
  };
}

function toPharmacyForm(d: PharmacyDetail): PharmacyForm {
  const { lat, lng } = coords(d.location);
  return {
    name: d.name,
    phone: d.phone ?? '',
    email: d.email ?? '',
    city: d.city,
    slug: d.slug,
    licenseNumber: d.licenseNumber ?? '',
    photoUrl: d.photoUrl ?? '',
    about: d.about ?? '',
    lat,
    lng,
    isActive: d.isActive,
    verificationStatus: d.verificationStatus,
  };
}

function toCaretakerForm(d: CaretakerDetail): CaretakerForm {
  const { lat, lng } = coords(d.location);
  return {
    name: d.name,
    phone: '',
    email: '',
    city: d.city,
    slug: d.slug,
    photoUrl: d.photoUrl ?? '',
    gender: d.gender ?? 'female',
    qualifications: (d.qualifications ?? []).join(', '),
    experienceYears: String(d.experienceYears ?? 0),
    about: d.about ?? '',
    services: (d.services ?? []).join(', '),
    hourlyRate: String(d.hourlyRate ?? 0),
    rating: String(d.rating ?? 0),
    reviewCount: String(d.reviewCount ?? 0),
    patientRecommendationPercent: String(d.patientRecommendationPercent ?? 0),
    lat,
    lng,
    isActive: d.isActive,
    verificationStatus: d.verificationStatus,
  };
}

function ambulancePayload(values: AmbulanceForm) {
  return {
    name: values.name,
    vehicleNumber: values.vehicleNumber,
    ambulanceType: values.ambulanceType,
    driverName: values.driverName || undefined,
    phone: values.phone || undefined,
    zone: values.zone || undefined,
    city: values.city || undefined,
    photoUrl: values.photoUrl.startsWith('http') ? values.photoUrl : undefined,
    location: locationPayload(values.lat, values.lng),
    isActive: values.isActive,
    verificationStatus: values.verificationStatus,
  };
}

function pharmacyPayload(values: PharmacyForm) {
  return {
    name: values.name,
    phone: values.phone || undefined,
    email: values.email || undefined,
    city: values.city,
    slug: values.slug || undefined,
    licenseNumber: values.licenseNumber || undefined,
    photoUrl: values.photoUrl.startsWith('http') ? values.photoUrl : undefined,
    about: values.about || undefined,
    location: locationPayload(values.lat, values.lng),
    isActive: values.isActive,
    verificationStatus: values.verificationStatus,
  };
}

function caretakerPayload(values: CaretakerForm) {
  return {
    name: values.name,
    phone: values.phone || undefined,
    email: values.email || undefined,
    city: values.city,
    slug: values.slug || undefined,
    photoUrl: values.photoUrl.startsWith('http') ? values.photoUrl : undefined,
    gender: values.gender || undefined,
    qualifications: parseList(values.qualifications),
    experienceYears: Number(values.experienceYears) || 0,
    about: values.about || undefined,
    services: parseList(values.services),
    hourlyRate: Number(values.hourlyRate) || 0,
    rating: Number(values.rating) || 0,
    reviewCount: Number(values.reviewCount) || 0,
    patientRecommendationPercent: Number(values.patientRecommendationPercent) || 0,
    location: locationPayload(values.lat, values.lng),
    isActive: values.isActive,
    verificationStatus: values.verificationStatus,
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

function PhotoField({
  initials,
  photoUrl,
  fileRef,
  onPickPhoto,
}: {
  initials: string;
  photoUrl: string;
  fileRef: RefObject<HTMLInputElement | null>;
  onPickPhoto: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <Avatar initials={initials} src={photoUrl || null} className="size-16" />
      <FormField label="Photo">
        <Button type="button" variant="soft" onClick={() => fileRef.current?.click()}>
          {photoUrl ? 'Change photo' : 'Upload photo'}
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
  );
}

function StatusFields({
  verificationStatus,
  isActive,
  onChange,
}: {
  verificationStatus: string;
  isActive: boolean;
  onChange: (patch: { verificationStatus?: string; isActive?: boolean }) => void;
}) {
  return (
    <>
      <FormField label="Status">
        <Select value={verificationStatus} onChange={(e) => onChange({ verificationStatus: e.target.value })}>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="suspended">Suspended</option>
        </Select>
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => onChange({ isActive: e.target.checked })} />
        Active
      </label>
    </>
  );
}

export function ProvidersPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<ProviderKind>('ambulance');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [error, setError] = useState('');
  const [ambulance, setAmbulance] = useState(emptyAmbulance);
  const [pharmacy, setPharmacy] = useState(emptyPharmacy);
  const [caretaker, setCaretaker] = useState(emptyCaretaker);
  const [viewId, setViewId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [editAmbulance, setEditAmbulance] = useState<AmbulanceForm | null>(null);
  const [editPharmacy, setEditPharmacy] = useState<PharmacyForm | null>(null);
  const [editCaretaker, setEditCaretaker] = useState<CaretakerForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [photoTarget, setPhotoTarget] = useState<'register' | 'edit'>('edit');
  const fileRef = useRef<HTMLInputElement>(null);
  const registerFileRef = useRef<HTMLInputElement>(null);

  const summary = useQuery({
    queryKey: ['ops-summary'],
    queryFn: () =>
      apiRequest<{ providers: { ambulance: number; pharmacy: number; caretaker: number } }>(
        '/admin/ops/summary',
      ),
  });

  const list = useQuery({
    queryKey: ['network-providers', type, q, status, page],
    queryFn: () =>
      apiRequest<Page>(`/admin/network/providers${qs({ type, q, status, page, limit: 10 })}`),
  });

  const detail = useQuery({
    queryKey: ['network-provider', type, viewId],
    queryFn: () => apiRequest<ProviderDetail>(`/admin/network/providers/${type}/${viewId}`),
    enabled: Boolean(viewId),
  });

  useEffect(() => {
    if (mode !== 'edit' || !detail.data) return;
    if (type === 'ambulance' && !editAmbulance) setEditAmbulance(toAmbulanceForm(detail.data as AmbulanceDetail));
    if (type === 'pharmacy' && !editPharmacy) setEditPharmacy(toPharmacyForm(detail.data as PharmacyDetail));
    if (type === 'caretaker' && !editCaretaker) setEditCaretaker(toCaretakerForm(detail.data as CaretakerDetail));
  }, [mode, detail.data, type, editAmbulance, editPharmacy, editCaretaker]);

  const create = useMutation({
    mutationFn: () => {
      if (type === 'ambulance') {
        return apiRequest('/admin/network/providers/ambulance', {
          method: 'POST',
          body: JSON.stringify(ambulancePayload(ambulance)),
        });
      }
      if (type === 'pharmacy') {
        return apiRequest('/admin/network/providers/pharmacy', {
          method: 'POST',
          body: JSON.stringify(pharmacyPayload(pharmacy)),
        });
      }
      return apiRequest('/admin/network/providers/caretaker', {
        method: 'POST',
        body: JSON.stringify(caretakerPayload(caretaker)),
      });
    },
    onSuccess: () => {
      setRegisterOpen(false);
      resetRegister();
      void qc.invalidateQueries({ queryKey: ['network-providers'] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const update = useMutation({
    mutationFn: () => {
      if (!viewId) throw new Error('Nothing to save');
      const body =
        type === 'ambulance'
          ? editAmbulance && ambulancePayload(editAmbulance)
          : type === 'pharmacy'
            ? editPharmacy && pharmacyPayload(editPharmacy)
            : editCaretaker && caretakerPayload(editCaretaker);
      if (!body) throw new Error('Nothing to save');
      return apiRequest<ProviderDetail>(`/admin/network/providers/${type}/${viewId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setMode('view');
      setDetailError('');
      void qc.invalidateQueries({ queryKey: ['network-providers'] });
      void qc.invalidateQueries({ queryKey: ['network-provider', type, viewId] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => setDetailError(err.message),
  });

  const remove = useMutation({
    mutationFn: () => apiRequest(`/admin/network/providers/${type}/${viewId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setViewId(null);
      setConfirmDelete(false);
      setMode('view');
      void qc.invalidateQueries({ queryKey: ['network-providers'] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => {
      const message =
        err instanceof ApiError && err.code === 'PROVIDER_HAS_OPEN_BOOKINGS'
          ? 'This provider has open bookings and cannot be deleted.'
          : err.message;
      setDetailError(message);
    },
  });

  const uploadPhoto = useMutation({
    mutationFn: async (blob: Blob) => {
      if (photoTarget === 'register') {
        const data = await apiUploadBinary<{ publicUrl: string; key: string }>(
          `/admin/network/providers/${type}/photo`,
          blob,
          'image/jpeg',
        );
        return { kind: 'register' as const, data };
      }
      if (!viewId) throw new Error('Provider is not loaded yet');
      const data = await apiUploadBinary<ProviderDetail>(
        `/admin/network/providers/${type}/${viewId}/photo`,
        blob,
        'image/jpeg',
      );
      return { kind: 'edit' as const, data };
    },
    onSuccess: (result) => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      const url =
        result.kind === 'register' ? result.data.publicUrl : (result.data.photoUrl ?? '');
      if (result.kind === 'register') {
        if (type === 'ambulance') setAmbulance((current) => ({ ...current, photoUrl: url }));
        if (type === 'pharmacy') setPharmacy((current) => ({ ...current, photoUrl: url }));
        if (type === 'caretaker') setCaretaker((current) => ({ ...current, photoUrl: url }));
        return;
      }
      if (type === 'ambulance') setEditAmbulance((current) => (current ? { ...current, photoUrl: url } : current));
      if (type === 'pharmacy') setEditPharmacy((current) => (current ? { ...current, photoUrl: url } : current));
      if (type === 'caretaker') setEditCaretaker((current) => (current ? { ...current, photoUrl: url } : current));
      qc.setQueryData(['network-provider', type, viewId], result.data);
      void qc.invalidateQueries({ queryKey: ['network-providers'] });
    },
    onError: (err: Error) => {
      if (photoTarget === 'register') setError(err.message);
      else setDetailError(err.message);
    },
  });

  function resetRegister() {
    setAmbulance(emptyAmbulance());
    setPharmacy(emptyPharmacy());
    setCaretaker(emptyCaretaker());
    setError('');
  }

  function closeRegister() {
    setRegisterOpen(false);
    resetRegister();
    if (photoTarget === 'register' && cropSrc) {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  }

  function closeDetail() {
    setViewId(null);
    setMode('view');
    setEditAmbulance(null);
    setEditPharmacy(null);
    setEditCaretaker(null);
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

  const counts = summary.data?.providers;
  const data = list.data;
  const provider = detail.data;

  return (
    <div>
      <PageHeader
        eyebrow={`Network • ${counts ? counts.ambulance + counts.pharmacy + counts.caretaker : 0} providers`}
        title="Service Providers"
        subtitle="Ambulance fleets, pharmacies and caretakers available for on-demand booking."
        action={
          <Button
            onClick={() => {
              resetRegister();
              setRegisterOpen(true);
            }}
          >
            {type === 'ambulance' ? '+ Add ambulance' : type === 'pharmacy' ? '+ Add pharmacy' : '+ Add caretaker'}
          </Button>
        }
      />
      <div className="mb-4">
        <Tabs
          value={type}
          onChange={(id) => {
            setType(id as ProviderKind);
            setPage(1);
            closeDetail();
          }}
          items={[
            { id: 'ambulance', label: 'Ambulance', count: counts?.ambulance },
            { id: 'pharmacy', label: 'Pharmacy', count: counts?.pharmacy },
            { id: 'caretaker', label: 'Caretaker', count: counts?.caretaker },
          ]}
        />
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder={`Search ${noun(type)}s`}
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
      </div>

      {type === 'ambulance' ? (
        <Table headers={['Provider', 'Vehicle no.', 'Type', 'Driver', 'Zone', 'Live', 'Status', '']}>
          {(data?.items ?? []).map((row) => (
            <tr key={row.id} className="hover:bg-[#f8fafb]">
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar initials={row.initials} src={row.photoUrl} className="size-9 text-xs" />
                  <div>
                    <div className="font-semibold text-[var(--ink)]">{row.name}</div>
                    <div className="text-xs text-[var(--muted)]">Fleet ID {row.fleetId}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5">{row.vehicleNumber}</td>
              <td className="px-4 py-3.5 capitalize">{row.type}</td>
              <td className="px-4 py-3.5">{row.driverName || '—'}</td>
              <td className="px-4 py-3.5">{row.zone || '—'}</td>
              <td className="px-4 py-3.5">
                <StatusDot status={(row.liveStatus ?? '').replace('_', ' ')} />
              </td>
              <td className="px-4 py-3.5">
                <StatusPill status={row.verificationStatus} />
              </td>
              <td className="px-4 py-3.5 text-right">
                <button
                  type="button"
                  className="text-sm font-medium text-[var(--brand)] hover:underline"
                  onClick={() => {
                    setMode('view');
                    setConfirmDelete(false);
                    setDetailError('');
                    setViewId(row.id);
                  }}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </Table>
      ) : type === 'pharmacy' ? (
        <Table headers={['Provider', 'City', 'License', 'Phone', 'Status', '']}>
          {(data?.items ?? []).map((row) => (
            <tr key={row.id} className="hover:bg-[#f8fafb]">
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar initials={row.initials} src={row.photoUrl} className="size-9 text-xs" />
                  <div className="font-semibold text-[var(--ink)]">{row.name}</div>
                </div>
              </td>
              <td className="px-4 py-3.5">{row.city || '—'}</td>
              <td className="px-4 py-3.5">{row.licenseNumber || '—'}</td>
              <td className="px-4 py-3.5">{row.phone || '—'}</td>
              <td className="px-4 py-3.5">
                <StatusPill status={row.verificationStatus} />
              </td>
              <td className="px-4 py-3.5 text-right">
                <button
                  type="button"
                  className="text-sm font-medium text-[var(--brand)] hover:underline"
                  onClick={() => {
                    setMode('view');
                    setConfirmDelete(false);
                    setDetailError('');
                    setViewId(row.id);
                  }}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Table headers={['Provider', 'City', 'Services', 'Rate', 'Status', '']}>
          {(data?.items ?? []).map((row) => (
            <tr key={row.id} className="hover:bg-[#f8fafb]">
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar initials={row.initials} src={row.photoUrl} className="size-9 text-xs" />
                  <div className="font-semibold text-[var(--ink)]">{row.name}</div>
                </div>
              </td>
              <td className="px-4 py-3.5">{row.city || '—'}</td>
              <td className="px-4 py-3.5">{row.services?.length ? row.services.join(', ') : '—'}</td>
              <td className="px-4 py-3.5">{row.hourlyRate ? `${formatInr(row.hourlyRate)}/hr` : '—'}</td>
              <td className="px-4 py-3.5">
                <StatusPill status={row.verificationStatus} />
              </td>
              <td className="px-4 py-3.5 text-right">
                <button
                  type="button"
                  className="text-sm font-medium text-[var(--brand)] hover:underline"
                  onClick={() => {
                    setMode('view');
                    setConfirmDelete(false);
                    setDetailError('');
                    setViewId(row.id);
                  }}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {data ? (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={data.limit}
          onPage={setPage}
        />
      ) : null}

      <Modal open={registerOpen} size="lg" title={`Add ${noun(type)}`} onClose={closeRegister}>
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setError('');
            create.mutate();
          }}
        >
          {type === 'ambulance' ? (
            <>
              <PhotoField
                initials={initialsFromName(ambulance.name)}
                photoUrl={ambulance.photoUrl}
                fileRef={registerFileRef}
                onPickPhoto={(e) => onPickPhoto('register', e)}
              />
              <FormField label="Fleet name">
                <Input value={ambulance.name} onChange={(e) => setAmbulance({ ...ambulance, name: e.target.value })} required />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Vehicle number">
                  <Input
                    value={ambulance.vehicleNumber}
                    onChange={(e) => setAmbulance({ ...ambulance, vehicleNumber: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Type">
                  <Select
                    value={ambulance.ambulanceType}
                    onChange={(e) => setAmbulance({ ...ambulance, ambulanceType: e.target.value })}
                  >
                    <option value="basic">Basic</option>
                    <option value="advanced">ICU / Advanced</option>
                    <option value="air">Air</option>
                  </Select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Driver name">
                  <Input value={ambulance.driverName} onChange={(e) => setAmbulance({ ...ambulance, driverName: e.target.value })} />
                </FormField>
                <FormField label="Driver phone">
                  <Input value={ambulance.phone} onChange={(e) => setAmbulance({ ...ambulance, phone: e.target.value })} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Zone">
                  <Input value={ambulance.zone} onChange={(e) => setAmbulance({ ...ambulance, zone: e.target.value })} />
                </FormField>
                <FormField label="City">
                  <Input value={ambulance.city} onChange={(e) => setAmbulance({ ...ambulance, city: e.target.value })} />
                </FormField>
              </div>
              <FormField label="Base location">
                <LocationPicker
                  lat={ambulance.lat}
                  lng={ambulance.lng}
                  onChange={(lat, lng) => setAmbulance({ ...ambulance, lat, lng })}
                />
              </FormField>
              <StatusFields
                verificationStatus={ambulance.verificationStatus}
                isActive={ambulance.isActive}
                onChange={(patch) => setAmbulance({ ...ambulance, ...patch })}
              />
            </>
          ) : null}
          {type === 'pharmacy' ? (
            <>
              <PhotoField
                initials={initialsFromName(pharmacy.name)}
                photoUrl={pharmacy.photoUrl}
                fileRef={registerFileRef}
                onPickPhoto={(e) => onPickPhoto('register', e)}
              />
              <FormField label="Pharmacy name">
                <Input value={pharmacy.name} onChange={(e) => setPharmacy({ ...pharmacy, name: e.target.value })} required />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Phone">
                  <Input value={pharmacy.phone} onChange={(e) => setPharmacy({ ...pharmacy, phone: e.target.value })} required />
                </FormField>
                <FormField label="Email">
                  <Input type="email" value={pharmacy.email} onChange={(e) => setPharmacy({ ...pharmacy, email: e.target.value })} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="City">
                  <Input value={pharmacy.city} onChange={(e) => setPharmacy({ ...pharmacy, city: e.target.value })} required />
                </FormField>
                <FormField label="License number">
                  <Input
                    value={pharmacy.licenseNumber}
                    onChange={(e) => setPharmacy({ ...pharmacy, licenseNumber: e.target.value })}
                  />
                </FormField>
              </div>
              <FormField label="Location">
                <LocationPicker
                  lat={pharmacy.lat}
                  lng={pharmacy.lng}
                  onChange={(lat, lng) => setPharmacy({ ...pharmacy, lat, lng })}
                />
              </FormField>
              <FormField label="About">
                <Textarea value={pharmacy.about} onChange={(e) => setPharmacy({ ...pharmacy, about: e.target.value })} />
              </FormField>
              <StatusFields
                verificationStatus={pharmacy.verificationStatus}
                isActive={pharmacy.isActive}
                onChange={(patch) => setPharmacy({ ...pharmacy, ...patch })}
              />
            </>
          ) : null}
          {type === 'caretaker' ? (
            <>
              <PhotoField
                initials={initialsFromName(caretaker.name)}
                photoUrl={caretaker.photoUrl}
                fileRef={registerFileRef}
                onPickPhoto={(e) => onPickPhoto('register', e)}
              />
              <FormField label="Caretaker name">
                <Input value={caretaker.name} onChange={(e) => setCaretaker({ ...caretaker, name: e.target.value })} required />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Phone">
                  <Input value={caretaker.phone} onChange={(e) => setCaretaker({ ...caretaker, phone: e.target.value })} required />
                </FormField>
                <FormField label="Email">
                  <Input type="email" value={caretaker.email} onChange={(e) => setCaretaker({ ...caretaker, email: e.target.value })} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="City">
                  <Input value={caretaker.city} onChange={(e) => setCaretaker({ ...caretaker, city: e.target.value })} required />
                </FormField>
                <FormField label="Gender">
                  <Select value={caretaker.gender} onChange={(e) => setCaretaker({ ...caretaker, gender: e.target.value })}>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Services">
                <Input
                  placeholder="Elder care, Post-op"
                  value={caretaker.services}
                  onChange={(e) => setCaretaker({ ...caretaker, services: e.target.value })}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Hourly rate">
                  <Input
                    type="number"
                    min={0}
                    value={caretaker.hourlyRate}
                    onChange={(e) => setCaretaker({ ...caretaker, hourlyRate: e.target.value })}
                  />
                </FormField>
                <FormField label="Experience (years)">
                  <Input
                    type="number"
                    min={0}
                    value={caretaker.experienceYears}
                    onChange={(e) => setCaretaker({ ...caretaker, experienceYears: e.target.value })}
                  />
                </FormField>
              </div>
              <FormField label="Qualifications">
                <Input
                  placeholder="GNM, BSc Nursing"
                  value={caretaker.qualifications}
                  onChange={(e) => setCaretaker({ ...caretaker, qualifications: e.target.value })}
                />
              </FormField>
              <FormField label="Location">
                <LocationPicker
                  lat={caretaker.lat}
                  lng={caretaker.lng}
                  onChange={(lat, lng) => setCaretaker({ ...caretaker, lat, lng })}
                />
              </FormField>
              <FormField label="About">
                <Textarea value={caretaker.about} onChange={(e) => setCaretaker({ ...caretaker, about: e.target.value })} />
              </FormField>
              <StatusFields
                verificationStatus={caretaker.verificationStatus}
                isActive={caretaker.isActive}
                onChange={(patch) => setCaretaker({ ...caretaker, ...patch })}
              />
            </>
          ) : null}
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewId)}
        size="lg"
        title={mode === 'edit' ? `Edit ${noun(type)}` : provider?.name || 'Service provider'}
        onClose={closeDetail}
      >
        {!provider && viewId ? <p className="text-sm text-[var(--muted)]">Loading provider profile…</p> : null}

        {provider && mode === 'view' ? (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <Avatar initials={provider.initials} src={provider.photoUrl} className="size-20 text-lg" />
              <div className="min-w-0">
                <div className="text-xl font-semibold">{provider.name}</div>
                <div className="text-sm text-[var(--muted)] mt-0.5 capitalize">
                  {noun(type)}
                  {'city' in provider && provider.city ? ` • ${provider.city}` : ''}
                </div>
                <div className="mt-2">
                  <StatusPill status={provider.verificationStatus} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {type === 'ambulance' ? (
                <>
                  <Field label="Fleet ID" value={(provider as AmbulanceDetail).fleetId} />
                  <Field label="Vehicle no." value={(provider as AmbulanceDetail).vehicleNumber} />
                  <Field label="Type" value={(provider as AmbulanceDetail).ambulanceType} />
                  <Field label="Driver" value={(provider as AmbulanceDetail).driverName} />
                  <Field label="Phone" value={(provider as AmbulanceDetail).phone} />
                  <Field label="Zone" value={(provider as AmbulanceDetail).zone} />
                  <Field label="City" value={(provider as AmbulanceDetail).city} />
                  <Field label="Live status" value={(provider as AmbulanceDetail).liveStatus?.replace('_', ' ')} />
                  <Field label="Location" value={formatCoords((provider as AmbulanceDetail).location)} />
                </>
              ) : null}
              {type === 'pharmacy' ? (
                <>
                  <Field label="Slug" value={(provider as PharmacyDetail).slug} />
                  <Field label="User ID" value={(provider as PharmacyDetail).userId} />
                  <Field label="Phone" value={(provider as PharmacyDetail).phone} />
                  <Field label="Email" value={(provider as PharmacyDetail).email} />
                  <Field label="License" value={(provider as PharmacyDetail).licenseNumber} />
                  <Field label="City" value={(provider as PharmacyDetail).city} />
                  <Field label="Location" value={formatCoords((provider as PharmacyDetail).location)} />
                </>
              ) : null}
              {type === 'caretaker' ? (
                <>
                  <Field label="Slug" value={(provider as CaretakerDetail).slug} />
                  <Field label="User ID" value={(provider as CaretakerDetail).userId} />
                  <Field label="Gender" value={(provider as CaretakerDetail).gender} />
                  <Field label="City" value={(provider as CaretakerDetail).city} />
                  <Field label="Services" value={(provider as CaretakerDetail).services?.join(', ')} />
                  <Field label="Hourly rate" value={formatInr((provider as CaretakerDetail).hourlyRate)} />
                  <Field label="Experience" value={`${(provider as CaretakerDetail).experienceYears} yrs`} />
                  <Field label="Qualifications" value={(provider as CaretakerDetail).qualifications?.join(', ')} />
                  <Field label="Rating" value={(provider as CaretakerDetail).rating} />
                  <Field label="Reviews" value={(provider as CaretakerDetail).reviewCount} />
                  <Field
                    label="Patient recommendation"
                    value={`${(provider as CaretakerDetail).patientRecommendationPercent}%`}
                  />
                  <Field label="Location" value={formatCoords((provider as CaretakerDetail).location)} />
                </>
              ) : null}
              <Field label="Active" value={provider.isActive ? 'Yes' : 'No'} />
              <Field label="Status" value={provider.verificationStatus} />
              <Field label="Created" value={new Date(provider.createdAt).toLocaleString('en-IN')} />
              <Field label="Updated" value={new Date(provider.updatedAt).toLocaleString('en-IN')} />
            </div>
            {'about' in provider ? (
              <div>
                <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--muted)]">About</div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{provider.about || '—'}</p>
              </div>
            ) : null}
            <ErrorText>{detailError}</ErrorText>
            {confirmDelete ? (
              <div className="rounded-lg border border-[#fecdca] bg-[#fef3f2] p-3">
                <p className="text-sm text-[#b42318]">
                  Delete {provider.name} from the network? This cannot be undone from the console.
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
                    if (type === 'ambulance') setEditAmbulance(toAmbulanceForm(provider as AmbulanceDetail));
                    if (type === 'pharmacy') setEditPharmacy(toPharmacyForm(provider as PharmacyDetail));
                    if (type === 'caretaker') setEditCaretaker(toCaretakerForm(provider as CaretakerDetail));
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

        {provider && mode === 'edit' ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setDetailError('');
              update.mutate();
            }}
          >
            {type === 'ambulance' && editAmbulance ? (
              <>
                <PhotoField
                  initials={provider.initials}
                  photoUrl={editAmbulance.photoUrl}
                  fileRef={fileRef}
                  onPickPhoto={(e) => onPickPhoto('edit', e)}
                />
                <FormField label="Fleet name">
                  <Input
                    value={editAmbulance.name}
                    onChange={(e) => setEditAmbulance({ ...editAmbulance, name: e.target.value })}
                    required
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Vehicle number">
                    <Input
                      value={editAmbulance.vehicleNumber}
                      onChange={(e) => setEditAmbulance({ ...editAmbulance, vehicleNumber: e.target.value })}
                      required
                    />
                  </FormField>
                  <FormField label="Type">
                    <Select
                      value={editAmbulance.ambulanceType}
                      onChange={(e) => setEditAmbulance({ ...editAmbulance, ambulanceType: e.target.value })}
                    >
                      <option value="basic">Basic</option>
                      <option value="advanced">ICU / Advanced</option>
                      <option value="air">Air</option>
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Driver name">
                    <Input
                      value={editAmbulance.driverName}
                      onChange={(e) => setEditAmbulance({ ...editAmbulance, driverName: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Driver phone">
                    <Input
                      value={editAmbulance.phone}
                      onChange={(e) => setEditAmbulance({ ...editAmbulance, phone: e.target.value })}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Zone">
                    <Input
                      value={editAmbulance.zone}
                      onChange={(e) => setEditAmbulance({ ...editAmbulance, zone: e.target.value })}
                    />
                  </FormField>
                  <FormField label="City">
                    <Input
                      value={editAmbulance.city}
                      onChange={(e) => setEditAmbulance({ ...editAmbulance, city: e.target.value })}
                    />
                  </FormField>
                </div>
                <FormField label="Base location">
                  <LocationPicker
                    lat={editAmbulance.lat}
                    lng={editAmbulance.lng}
                    onChange={(lat, lng) => setEditAmbulance({ ...editAmbulance, lat, lng })}
                  />
                </FormField>
                <StatusFields
                  verificationStatus={editAmbulance.verificationStatus}
                  isActive={editAmbulance.isActive}
                  onChange={(patch) => setEditAmbulance({ ...editAmbulance, ...patch })}
                />
              </>
            ) : null}
            {type === 'pharmacy' && editPharmacy ? (
              <>
                <PhotoField
                  initials={provider.initials}
                  photoUrl={editPharmacy.photoUrl}
                  fileRef={fileRef}
                  onPickPhoto={(e) => onPickPhoto('edit', e)}
                />
                <FormField label="Pharmacy name">
                  <Input
                    value={editPharmacy.name}
                    onChange={(e) => setEditPharmacy({ ...editPharmacy, name: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Slug">
                  <Input value={editPharmacy.slug} onChange={(e) => setEditPharmacy({ ...editPharmacy, slug: e.target.value })} required />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Phone">
                    <Input value={editPharmacy.phone} onChange={(e) => setEditPharmacy({ ...editPharmacy, phone: e.target.value })} />
                  </FormField>
                  <FormField label="Email">
                    <Input
                      type="email"
                      value={editPharmacy.email}
                      onChange={(e) => setEditPharmacy({ ...editPharmacy, email: e.target.value })}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="City">
                    <Input value={editPharmacy.city} onChange={(e) => setEditPharmacy({ ...editPharmacy, city: e.target.value })} required />
                  </FormField>
                  <FormField label="License number">
                    <Input
                      value={editPharmacy.licenseNumber}
                      onChange={(e) => setEditPharmacy({ ...editPharmacy, licenseNumber: e.target.value })}
                    />
                  </FormField>
                </div>
                <FormField label="Location">
                  <LocationPicker
                    lat={editPharmacy.lat}
                    lng={editPharmacy.lng}
                    onChange={(lat, lng) => setEditPharmacy({ ...editPharmacy, lat, lng })}
                  />
                </FormField>
                <FormField label="About">
                  <Textarea value={editPharmacy.about} onChange={(e) => setEditPharmacy({ ...editPharmacy, about: e.target.value })} />
                </FormField>
                <StatusFields
                  verificationStatus={editPharmacy.verificationStatus}
                  isActive={editPharmacy.isActive}
                  onChange={(patch) => setEditPharmacy({ ...editPharmacy, ...patch })}
                />
              </>
            ) : null}
            {type === 'caretaker' && editCaretaker ? (
              <>
                <PhotoField
                  initials={provider.initials}
                  photoUrl={editCaretaker.photoUrl}
                  fileRef={fileRef}
                  onPickPhoto={(e) => onPickPhoto('edit', e)}
                />
                <FormField label="Caretaker name">
                  <Input
                    value={editCaretaker.name}
                    onChange={(e) => setEditCaretaker({ ...editCaretaker, name: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Slug">
                  <Input
                    value={editCaretaker.slug}
                    onChange={(e) => setEditCaretaker({ ...editCaretaker, slug: e.target.value })}
                    required
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="City">
                    <Input
                      value={editCaretaker.city}
                      onChange={(e) => setEditCaretaker({ ...editCaretaker, city: e.target.value })}
                      required
                    />
                  </FormField>
                  <FormField label="Gender">
                    <Select
                      value={editCaretaker.gender}
                      onChange={(e) => setEditCaretaker({ ...editCaretaker, gender: e.target.value })}
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </Select>
                  </FormField>
                </div>
                <FormField label="Services">
                  <Input
                    value={editCaretaker.services}
                    onChange={(e) => setEditCaretaker({ ...editCaretaker, services: e.target.value })}
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Hourly rate">
                    <Input
                      type="number"
                      min={0}
                      value={editCaretaker.hourlyRate}
                      onChange={(e) => setEditCaretaker({ ...editCaretaker, hourlyRate: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Experience (years)">
                    <Input
                      type="number"
                      min={0}
                      value={editCaretaker.experienceYears}
                      onChange={(e) => setEditCaretaker({ ...editCaretaker, experienceYears: e.target.value })}
                    />
                  </FormField>
                </div>
                <FormField label="Qualifications">
                  <Input
                    value={editCaretaker.qualifications}
                    onChange={(e) => setEditCaretaker({ ...editCaretaker, qualifications: e.target.value })}
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Rating">
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      step="0.1"
                      value={editCaretaker.rating}
                      onChange={(e) => setEditCaretaker({ ...editCaretaker, rating: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Reviews">
                    <Input
                      type="number"
                      min={0}
                      value={editCaretaker.reviewCount}
                      onChange={(e) => setEditCaretaker({ ...editCaretaker, reviewCount: e.target.value })}
                    />
                  </FormField>
                </div>
                <FormField label="Location">
                  <LocationPicker
                    lat={editCaretaker.lat}
                    lng={editCaretaker.lng}
                    onChange={(lat, lng) => setEditCaretaker({ ...editCaretaker, lat, lng })}
                  />
                </FormField>
                <FormField label="About">
                  <Textarea
                    value={editCaretaker.about}
                    onChange={(e) => setEditCaretaker({ ...editCaretaker, about: e.target.value })}
                  />
                </FormField>
                <StatusFields
                  verificationStatus={editCaretaker.verificationStatus}
                  isActive={editCaretaker.isActive}
                  onChange={(patch) => setEditCaretaker({ ...editCaretaker, ...patch })}
                />
              </>
            ) : null}
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
