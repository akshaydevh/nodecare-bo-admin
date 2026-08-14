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
  StatusPill,
  Table,
  Textarea,
} from '../components/ui';

type Doctor = {
  id: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  qualifications: string[];
  registrationNumber: string | null;
  specializations: string[];
  facility: string | null;
  city: string;
  experienceYears: number;
  consultationFee: number;
  rating: number;
  status: string;
};

type GeoPoint = { type: 'Point'; coordinates: [number, number] };

type DoctorDetail = {
  id: string;
  userId: string | null;
  name: string;
  slug: string;
  photoUrl: string | null;
  gender: 'male' | 'female' | 'other' | null;
  specialityIds: string[];
  specializations: string[];
  registrationNumber: string | null;
  qualifications: string[];
  experienceYears: number;
  about: string | null;
  languages: string[];
  consultationFee: number;
  rating: number;
  reviewCount: number;
  patientRecommendationPercent: number;
  hospitalExcellenceRating: number;
  clinicIds: string[];
  clinicNames: string[];
  hospitalIds: string[];
  hospitalNames: string[];
  primaryFacilityName: string | null;
  city: string;
  location: GeoPoint | null;
  isActive: boolean;
  isFeatured: boolean;
  verificationStatus: string;
  status: string;
  initials: string;
  createdAt: string;
  updatedAt: string;
};

type Speciality = { id: string; name: string; slug: string };

type Page = {
  items: Doctor[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  cities?: string[];
  specialities?: Speciality[];
};

type DoctorProfileForm = {
  name: string;
  phone?: string;
  email?: string;
  slug?: string;
  photoUrl: string;
  gender: string;
  specialityIds: string[];
  qualifications: string;
  registrationNumber: string;
  experienceYears: string;
  about: string;
  languages: string;
  consultationFee: string;
  rating: string;
  reviewCount: string;
  patientRecommendationPercent: string;
  hospitalExcellenceRating: string;
  clinicIds: string[];
  hospitalIds: string[];
  primaryFacilityName: string;
  city: string;
  lat: string;
  lng: string;
  isActive: boolean;
  isFeatured: boolean;
  verificationStatus: string;
};

type EditForm = DoctorProfileForm & { slug: string };

const emptyRegister: DoctorProfileForm = {
  name: '',
  phone: '',
  email: '',
  slug: '',
  photoUrl: '',
  gender: '',
  specialityIds: [],
  qualifications: '',
  registrationNumber: '',
  experienceYears: '5',
  about: '',
  languages: 'English, Hindi',
  consultationFee: '800',
  rating: '0',
  reviewCount: '0',
  patientRecommendationPercent: '0',
  hospitalExcellenceRating: '0',
  clinicIds: [],
  hospitalIds: [],
  primaryFacilityName: '',
  city: 'New Delhi',
  lat: '',
  lng: '',
  isActive: false,
  isFeatured: false,
  verificationStatus: 'pending',
};

function initialsFromName(name: string) {
  const next = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return next || 'DR';
}

function profilePayload(values: DoctorProfileForm) {
  return {
    name: values.name,
    slug: values.slug || undefined,
    photoUrl: values.photoUrl.startsWith('http') ? values.photoUrl : undefined,
    gender: values.gender || undefined,
    specialityIds: values.specialityIds,
    qualifications: commaList(values.qualifications),
    registrationNumber: values.registrationNumber || undefined,
    experienceYears: Number(values.experienceYears) || 0,
    about: values.about || undefined,
    languages: commaList(values.languages),
    consultationFee: Number(values.consultationFee) || 0,
    rating: Number(values.rating) || 0,
    reviewCount: Number(values.reviewCount) || 0,
    patientRecommendationPercent: Number(values.patientRecommendationPercent) || 0,
    hospitalExcellenceRating: Number(values.hospitalExcellenceRating) || 0,
    clinicIds: values.clinicIds,
    hospitalIds: values.hospitalIds,
    primaryFacilityName: values.primaryFacilityName || undefined,
    city: values.city,
    location:
      values.lat !== '' && values.lng !== ''
        ? { lat: Number(values.lat), lng: Number(values.lng) }
        : undefined,
    isActive: values.isActive,
    isFeatured: values.isFeatured,
    verificationStatus: values.verificationStatus,
  };
}

function DoctorFormFields({
  values,
  onChange,
  catalog,
  initials,
  showPhone = false,
  showSlug = false,
  fileRef,
  onPickPhoto,
}: {
  values: DoctorProfileForm;
  onChange: (patch: Partial<DoctorProfileForm>) => void;
  catalog?: { specialities: NamedOption[]; clinics: NamedOption[]; hospitals: NamedOption[] };
  initials: string;
  showPhone?: boolean;
  showSlug?: boolean;
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
      <FormField label="Full name">
        <Input value={values.name} onChange={(e) => onChange({ name: e.target.value })} required />
      </FormField>
      {showPhone ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Phone">
            <Input
              placeholder="+91 98XXXXXX"
              value={values.phone ?? ''}
              onChange={(e) => onChange({ phone: e.target.value })}
              required
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
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Gender">
          <Select value={values.gender} onChange={(e) => onChange({ gender: e.target.value })}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </FormField>
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
      </div>
      <FormField label="Specialization">
        <MultiSelect
          options={catalog?.specialities ?? []}
          value={values.specialityIds}
          onChange={(specialityIds) => onChange({ specialityIds })}
          placeholder="Select a specialization"
        />
      </FormField>
      <FormField label="Qualifications">
        <Input
          placeholder="MBBS, MD"
          value={values.qualifications}
          onChange={(e) => onChange({ qualifications: e.target.value })}
        />
      </FormField>
      <FormField label="Registration number">
        <Input
          placeholder="MH-88213"
          value={values.registrationNumber}
          onChange={(e) => onChange({ registrationNumber: e.target.value })}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Experience (years)">
          <Input
            type="number"
            min={0}
            value={values.experienceYears}
            onChange={(e) => onChange({ experienceYears: e.target.value })}
          />
        </FormField>
        <FormField label="Consultation fee">
          <Input
            type="number"
            min={0}
            value={values.consultationFee}
            onChange={(e) => onChange({ consultationFee: e.target.value })}
          />
        </FormField>
      </div>
      <FormField label="Languages">
        <Input
          placeholder="English, Hindi"
          value={values.languages}
          onChange={(e) => onChange({ languages: e.target.value })}
        />
      </FormField>
      <FormField label="Primary clinic / hospital">
        <Input
          value={values.primaryFacilityName}
          onChange={(e) => onChange({ primaryFacilityName: e.target.value })}
        />
      </FormField>
      <FormField label="Clinics">
        <MultiSelect
          options={catalog?.clinics ?? []}
          value={values.clinicIds}
          onChange={(clinicIds) => onChange({ clinicIds })}
          placeholder="Select a clinic"
        />
      </FormField>
      <FormField label="Hospitals">
        <MultiSelect
          options={catalog?.hospitals ?? []}
          value={values.hospitalIds}
          onChange={(hospitalIds) => onChange({ hospitalIds })}
          placeholder="Select a hospital"
        />
      </FormField>
      <FormField label="City">
        <Input value={values.city} onChange={(e) => onChange({ city: e.target.value })} required />
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
        <FormField label="Hospital excellence">
          <Input
            type="number"
            min={0}
            max={5}
            step="0.1"
            value={values.hospitalExcellenceRating}
            onChange={(e) => onChange({ hospitalExcellenceRating: e.target.value })}
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

function commaList(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatCoords(location: GeoPoint | null) {
  if (!location?.coordinates) return '—';
  const [lng, lat] = location.coordinates;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--ink)] break-words">{value === 0 || value ? String(value) : '—'}</div>
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

type NamedOption = { id: string; name: string };

function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: NamedOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}) {
  if (!options.length) {
    return <p className="text-sm text-[var(--muted)]">No options available yet.</p>;
  }
  const available = options.filter((option) => !value.includes(option.id));
  const selected = value.map((id) => options.find((option) => option.id === id) ?? { id, name: id });
  return (
    <div className="space-y-2">
      <Select
        value=""
        disabled={available.length === 0}
        onChange={(e) => {
          const id = e.target.value;
          if (id) onChange([...value, id]);
        }}
      >
        <option value="">{available.length ? placeholder : 'All selected'}</option>
        {available.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </Select>
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((option) => (
            <button
              key={option.id}
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-sm text-[var(--brand)]"
              onClick={() => onChange(value.filter((id) => id !== option.id))}
            >
              {option.name}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function toEditForm(d: DoctorDetail): EditForm {
  const [lng, lat] = d.location?.coordinates ?? [];
  return {
    name: d.name,
    slug: d.slug,
    photoUrl: d.photoUrl ?? '',
    gender: d.gender ?? '',
    specialityIds: d.specialityIds,
    qualifications: d.qualifications.join(', '),
    registrationNumber: d.registrationNumber ?? '',
    experienceYears: String(d.experienceYears ?? 0),
    about: d.about ?? '',
    languages: d.languages.join(', '),
    consultationFee: String(d.consultationFee ?? 0),
    rating: String(d.rating ?? 0),
    reviewCount: String(d.reviewCount ?? 0),
    patientRecommendationPercent: String(d.patientRecommendationPercent ?? 0),
    hospitalExcellenceRating: String(d.hospitalExcellenceRating ?? 0),
    clinicIds: d.clinicIds,
    hospitalIds: d.hospitalIds,
    primaryFacilityName: d.primaryFacilityName ?? '',
    city: d.city,
    lat: lat !== undefined ? String(lat) : '',
    lng: lng !== undefined ? String(lng) : '',
    isActive: d.isActive,
    isFeatured: d.isFeatured,
    verificationStatus: d.verificationStatus,
  };
}

export function DoctorsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [page, setPage] = useState(1);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState(emptyRegister);
  const [error, setError] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [photoTarget, setPhotoTarget] = useState<'register' | 'edit'>('edit');
  const fileRef = useRef<HTMLInputElement>(null);
  const registerFileRef = useRef<HTMLInputElement>(null);

  const list = useQuery({
    queryKey: ['network-doctors', q, status, city, speciality, page],
    queryFn: () =>
      apiRequest<Page>(
        `/admin/network/doctors${qs({ q, status, city, speciality, page, limit: 10 })}`,
      ),
  });

  const detail = useQuery({
    queryKey: ['network-doctor', viewId],
    queryFn: () => apiRequest<DoctorDetail>(`/admin/network/doctors/${viewId}`),
    enabled: Boolean(viewId),
  });

  const options = useQuery({
    queryKey: ['doctor-edit-options'],
    queryFn: async () => {
      const [specialities, clinics, hospitals] = await Promise.all([
        apiRequest<{ items: NamedOption[] }>(`/admin/catalog/specialities${qs({ limit: 100 })}`),
        apiRequest<{ items: NamedOption[] }>(`/admin/catalog/clinics${qs({ limit: 100 })}`),
        apiRequest<{ items: NamedOption[] }>(`/admin/catalog/hospitals${qs({ limit: 100 })}`),
      ]);
      return {
        specialities: specialities.items,
        clinics: clinics.items,
        hospitals: hospitals.items,
      };
    },
    enabled: Boolean(viewId) || registerOpen,
  });

  useEffect(() => {
    if (mode === 'edit' && detail.data && !edit) {
      setEdit(toEditForm(detail.data));
    }
  }, [mode, detail.data, edit]);

  const create = useMutation({
    mutationFn: () =>
      apiRequest('/admin/network/doctors', {
        method: 'POST',
        body: JSON.stringify({
          ...profilePayload(form),
          phone: form.phone,
          email: form.email || undefined,
        }),
      }),
    onSuccess: () => {
      setRegisterOpen(false);
      setForm(emptyRegister);
      void qc.invalidateQueries({ queryKey: ['network-doctors'] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const update = useMutation({
    mutationFn: () => {
      if (!viewId || !edit) throw new Error('Nothing to save');
      return apiRequest<DoctorDetail>(`/admin/network/doctors/${viewId}`, {
        method: 'PATCH',
        body: JSON.stringify(profilePayload(edit)),
      });
    },
    onSuccess: () => {
      setMode('view');
      setDetailError('');
      void qc.invalidateQueries({ queryKey: ['network-doctors'] });
      void qc.invalidateQueries({ queryKey: ['network-doctor', viewId] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => setDetailError(err.message),
  });

  const remove = useMutation({
    mutationFn: () => apiRequest(`/admin/network/doctors/${viewId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setViewId(null);
      setConfirmDelete(false);
      setMode('view');
      void qc.invalidateQueries({ queryKey: ['network-doctors'] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => {
      const message =
        err instanceof ApiError && err.code === 'DOCTOR_HAS_OPEN_BOOKINGS'
          ? 'This doctor has upcoming or confirmed appointments and cannot be deleted.'
          : err.message;
      setDetailError(message);
    },
  });

  const uploadPhoto = useMutation({
    mutationFn: async (blob: Blob) => {
      if (photoTarget === 'register') {
        const data = await apiUploadBinary<{ publicUrl: string; key: string }>(
          '/admin/network/doctors/photo',
          blob,
          'image/jpeg',
        );
        return { kind: 'register' as const, data };
      }
      if (!viewId) throw new Error('Doctor is not loaded yet');
      const data = await apiUploadBinary<DoctorDetail>(
        `/admin/network/doctors/${viewId}/photo`,
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
      qc.setQueryData(['network-doctor', viewId], result.data);
      void qc.invalidateQueries({ queryKey: ['network-doctors'] });
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
    setForm(emptyRegister);
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
  const doctor = detail.data;
  const cities = data?.cities ?? [];
  const specialities = data?.specialities ?? [];

  return (
    <div>
      <PageHeader
        eyebrow={`Network • ${data?.total ?? 0} doctors`}
        title="Doctors"
        subtitle="Onboard, verify and manage every doctor available for consultation booking."
        action={
          <Button
            onClick={() => {
              setForm(emptyRegister);
              setError('');
              setRegisterOpen(true);
            }}
          >
            + Register doctor
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search by name or registration no."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="max-w-xs"
        />
        <Select
          value={speciality}
          onChange={(e) => {
            setPage(1);
            setSpeciality(e.target.value);
          }}
          className="max-w-[200px]"
        >
          <option value="">All specializations</option>
          {specialities.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </Select>
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
      <Table
        headers={[
          'Doctor',
          'Specialization',
          'Clinic / Hospital',
          'Experience',
          'Fee',
          'Rating',
          'Status',
          '',
        ]}
      >
        {(data?.items ?? []).map((d) => (
          <tr key={d.id} className="hover:bg-[#f8fafb]">
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                <Avatar initials={d.initials} src={d.photoUrl} className="size-9 text-xs" />
                <div>
                  <div className="font-semibold text-[var(--ink)]">{d.name}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {d.qualifications.join(', ') || '—'}
                    {d.registrationNumber ? ` • Reg# ${d.registrationNumber}` : ''}
                  </div>
                </div>
              </div>
            </td>
            <td className="px-4 py-3.5">{d.specializations.join(', ') || '—'}</td>
            <td className="px-4 py-3.5">
              {d.facility || '—'}
              {d.city ? `, ${d.city}` : ''}
            </td>
            <td className="px-4 py-3.5">{d.experienceYears} yrs</td>
            <td className="px-4 py-3.5">{formatInr(d.consultationFee)}</td>
            <td className="px-4 py-3.5">{d.rating ? `${d.rating.toFixed(1)} ★` : '—'}</td>
            <td className="px-4 py-3.5">
              <StatusPill status={d.status} />
            </td>
            <td className="px-4 py-3.5 text-right">
              <button
                type="button"
                className="text-sm font-medium text-[var(--brand)] hover:underline"
                onClick={() => {
                  setMode('view');
                  setConfirmDelete(false);
                  setDetailError('');
                  setViewId(d.id);
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

      <Modal open={registerOpen} size="lg" title="Register doctor" onClose={closeRegister}>
        <form className="space-y-3" onSubmit={onSubmit}>
          <DoctorFormFields
            values={form}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            catalog={options.data}
            initials={initialsFromName(form.name)}
            showPhone
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
        title={mode === 'edit' ? 'Edit doctor' : doctor?.name || 'Doctor'}
        onClose={closeDetail}
      >
        {!doctor && viewId ? (
          <p className="text-sm text-[var(--muted)]">Loading doctor profile…</p>
        ) : null}

        {doctor && mode === 'view' ? (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <Avatar initials={doctor.initials} src={doctor.photoUrl} className="size-20 text-lg" />
              <div className="min-w-0">
                <div className="text-xl font-semibold">{doctor.name}</div>
                <div className="text-sm text-[var(--muted)] mt-0.5">
                  {doctor.qualifications.join(', ') || '—'}
                  {doctor.registrationNumber ? ` • Reg# ${doctor.registrationNumber}` : ''}
                </div>
                <div className="mt-2">
                  <StatusPill status={doctor.verificationStatus} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Slug" value={doctor.slug} />
              <Field label="User ID" value={doctor.userId} />
              <Field label="Gender" value={doctor.gender} />
              <Field label="City" value={doctor.city} />
              <Field label="Specialization" value={doctor.specializations.join(', ')} />
              <Field label="Registration no." value={doctor.registrationNumber} />
              <Field label="Qualifications" value={doctor.qualifications.join(', ')} />
              <Field label="Experience" value={`${doctor.experienceYears} yrs`} />
              <Field label="Consultation fee" value={formatInr(doctor.consultationFee)} />
              <Field label="Languages" value={doctor.languages.join(', ')} />
              <Field label="Primary facility" value={doctor.primaryFacilityName} />
              <Field label="Clinics" value={doctor.clinicNames.join(', ')} />
              <Field label="Hospitals" value={doctor.hospitalNames.join(', ')} />
              <Field label="Rating" value={doctor.rating ? `${doctor.rating.toFixed(1)} ★` : '—'} />
              <Field label="Reviews" value={doctor.reviewCount} />
              <Field label="Patient recommendation" value={`${doctor.patientRecommendationPercent}%`} />
              <Field label="Hospital excellence" value={doctor.hospitalExcellenceRating} />
              <Field label="Location" value={formatCoords(doctor.location)} />
              <Field label="Active" value={doctor.isActive ? 'Yes' : 'No'} />
              <Field label="Featured" value={doctor.isFeatured ? 'Yes' : 'No'} />
              <Field label="Status" value={doctor.verificationStatus} />
              <Field label="Created" value={new Date(doctor.createdAt).toLocaleString('en-IN')} />
              <Field label="Updated" value={new Date(doctor.updatedAt).toLocaleString('en-IN')} />
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--muted)]">About</div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{doctor.about || '—'}</p>
            </div>

            <ErrorText>{detailError}</ErrorText>

            {confirmDelete ? (
              <div className="rounded-lg border border-[#fecdca] bg-[#fef3f2] p-3">
                <p className="text-sm text-[#b42318]">
                  Delete {doctor.name} from the network? This cannot be undone from the console.
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
                    setEdit(toEditForm(doctor));
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

        {doctor && mode === 'edit' && edit ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setDetailError('');
              update.mutate();
            }}
          >
            <DoctorFormFields
              values={edit}
              onChange={(patch) => setEdit((current) => (current ? { ...current, ...patch } : current))}
              catalog={options.data}
              initials={doctor.initials}
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
