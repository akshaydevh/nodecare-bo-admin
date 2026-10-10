import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar, Card, EmptyState, ErrorText, Input, SkeletonRows, StatusPill, Tabs } from '../../components/ui';
import { apiRequest, qs } from '../../lib/api';
import { PROVIDER_TYPE_LABEL, type ProviderType, type Target } from './types';

type Option = {
  id: string;
  name: string;
  initials?: string;
  photoUrl?: string | null;
  detail: string;
  status: string;
};

type ListResponse = { items: Record<string, unknown>[] };

function str(v: unknown) {
  return typeof v === 'string' ? v : '';
}

/** Reuses the network list endpoints that power the Doctors / Medical centres / Caretakers pages. */
async function searchProviders(type: ProviderType, q: string): Promise<Option[]> {
  const common = { q: q.trim(), page: 1, limit: 8 };
  const path =
    type === 'doctor'
      ? `/admin/network/doctors${qs(common)}`
      : type === 'nurse'
        ? `/admin/network/providers${qs({ ...common, type: 'caretaker' })}`
        : `/admin/network/medical-centres${qs({ ...common, kind: type })}`;
  const res = await apiRequest<ListResponse>(path);
  return res.items.map((item) => {
    const specs = Array.isArray(item.specializations) ? (item.specializations as string[]).join(', ') : '';
    const detail =
      type === 'doctor'
        ? [specs, str(item.facility), str(item.city)].filter(Boolean).join(' · ')
        : str(item.city);
    return {
      id: str(item.id),
      name: str(item.name),
      initials: str(item.initials),
      photoUrl: (item.photoUrl as string | null | undefined) ?? null,
      detail,
      status: str(item.status) || str(item.verificationStatus),
    };
  });
}

export function ProviderPicker({
  selected,
  onSelect,
}: {
  selected: Target | null;
  onSelect: (target: Target) => void;
}) {
  const [type, setType] = useState<ProviderType>(selected?.providerType ?? 'doctor');
  const [q, setQ] = useState('');

  const results = useQuery({
    queryKey: ['availability-picker', type, q.trim()],
    queryFn: () => searchProviders(type, q),
    placeholderData: keepPreviousData,
  });

  return (
    <Card className="p-4!">
      <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--muted)] mb-3">
        Choose a calendar
      </div>
      <Tabs
        value={type}
        onChange={(id) => setType(id as ProviderType)}
        items={(Object.keys(PROVIDER_TYPE_LABEL) as ProviderType[]).map((id) => ({
          id,
          label: PROVIDER_TYPE_LABEL[id],
        }))}
      />
      <Input
        className="mt-3"
        aria-label={`Search ${PROVIDER_TYPE_LABEL[type].toLowerCase()}s`}
        placeholder={`Search ${PROVIDER_TYPE_LABEL[type].toLowerCase()}s by name`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mt-3 -mx-1 max-h-[420px] overflow-y-auto">
        {results.isLoading ? <SkeletonRows rows={4} className="h-11" /> : null}
        {results.isError ? <ErrorText>{(results.error as Error).message}</ErrorText> : null}
        {results.data && results.data.length === 0 ? (
          <EmptyState title="No matches" body="Try another name or provider type." />
        ) : null}
        <ul className="space-y-0.5" role="listbox" aria-label="Providers">
          {(results.data ?? []).map((opt) => {
            const active = selected?.providerId === opt.id && selected.providerType === type;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  aria-label={`${opt.name}${opt.detail ? `, ${opt.detail}` : ''}`}
                  onClick={() => onSelect({ providerType: type, providerId: opt.id })}
                  className={`w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left ${
                    active ? 'bg-[var(--brand-soft)]' : 'hover:bg-[#f8fafb]'
                  }`}
                >
                  <Avatar initials={opt.initials || opt.name.slice(0, 2).toUpperCase()} src={opt.photoUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{opt.name}</span>
                    {opt.detail ? (
                      <span className="block text-xs text-[var(--muted)] truncate">{opt.detail}</span>
                    ) : null}
                  </span>
                  {opt.status && opt.status !== 'verified' ? <StatusPill status={opt.status} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
