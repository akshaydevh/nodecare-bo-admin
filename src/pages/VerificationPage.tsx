import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconBadgeCheck } from '../components/icons';
import {
  Avatar,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorText,
  PageHeader,
  SkeletonRows,
  Table,
  TableMessage,
  Tabs,
} from '../components/ui';
import { apiRequest, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { can } from '../lib/roles';

type Kind = 'doctor' | 'clinic' | 'hospital' | 'diagnostics' | 'caretaker' | 'pharmacy' | 'ambulance';

type Source = {
  kind: Kind;
  label: string;
  singular: string;
  list: string;
  verify: (id: string) => string;
  manage: string;
};

/** Each provider type: where to list pending ones and which verification endpoint to call. */
const SOURCES: Source[] = [
  {
    kind: 'doctor',
    label: 'Doctors',
    singular: 'Doctor',
    list: '/admin/network/doctors',
    verify: (id) => `/admin/network/doctors/${id}/verification`,
    manage: '/doctors',
  },
  {
    kind: 'clinic',
    label: 'Clinics',
    singular: 'Clinic',
    list: `/admin/network/medical-centres${qs({ kind: 'clinic' })}`,
    verify: (id) => `/admin/network/medical-centres/${id}/verification`,
    manage: '/medical-centres',
  },
  {
    kind: 'hospital',
    label: 'Hospitals',
    singular: 'Hospital',
    list: `/admin/network/medical-centres${qs({ kind: 'hospital' })}`,
    verify: (id) => `/admin/network/medical-centres/${id}/verification`,
    manage: '/medical-centres',
  },
  {
    kind: 'diagnostics',
    label: 'Diagnostic centres',
    singular: 'Diagnostic centre',
    list: '/admin/network/centres',
    verify: (id) => `/admin/network/centres/${id}/verification`,
    manage: '/centres',
  },
  {
    kind: 'caretaker',
    label: 'Caretakers',
    singular: 'Caretaker',
    list: `/admin/network/providers${qs({ type: 'caretaker' })}`,
    verify: (id) => `/admin/network/providers/caretaker/${id}/verification`,
    manage: '/providers/caretaker',
  },
  {
    kind: 'pharmacy',
    label: 'Pharmacies',
    singular: 'Pharmacy',
    list: `/admin/network/providers${qs({ type: 'pharmacy' })}`,
    verify: (id) => `/admin/network/providers/pharmacy/${id}/verification`,
    manage: '/providers/pharmacy',
  },
  {
    kind: 'ambulance',
    label: 'Ambulances',
    singular: 'Ambulance',
    list: `/admin/network/providers${qs({ type: 'ambulance' })}`,
    verify: (id) => `/admin/network/providers/ambulance/${id}/verification`,
    manage: '/providers/ambulance',
  },
];

type Row = {
  id: string;
  kind: Kind;
  name: string;
  initials: string;
  photoUrl: string | null;
  detail: string;
  phone: string | null;
  source: Source;
};

type ListResponse = { items: Record<string, unknown>[]; total: number };

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function toRow(source: Source, item: Record<string, unknown>): Row {
  const parts =
    source.kind === 'doctor'
      ? [
          Array.isArray(item.specializations) ? (item.specializations as string[]).join(', ') : '',
          str(item.registrationNumber) && `Reg. ${str(item.registrationNumber)}`,
          str(item.city),
        ]
      : source.kind === 'ambulance'
        ? [str(item.vehicleNumber), str(item.driverName), str(item.city)]
        : source.kind === 'pharmacy' || source.kind === 'diagnostics'
          ? [str(item.licenseNumber) && `Licence ${str(item.licenseNumber)}`, str(item.city)]
          : [str(item.city)];
  return {
    id: str(item.id),
    kind: source.kind,
    name: str(item.name),
    initials: str(item.initials) || str(item.name).slice(0, 2).toUpperCase(),
    photoUrl: (item.photoUrl as string | null | undefined) ?? null,
    detail: parts.filter(Boolean).join(' · '),
    phone: (item.phone as string | null | undefined) ?? null,
    source,
  };
}

const HEADERS = ['Provider', 'Type', 'Details', 'Phone', ''];

export function VerificationPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canWrite = can(user?.role, 'network');
  const [tab, setTab] = useState<Kind | 'all'>('all');
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const results = useQueries({
    queries: SOURCES.map((source) => ({
      queryKey: ['verification-queue', source.kind],
      queryFn: async () => {
        const sep = source.list.includes('?') ? '&' : '?';
        const res = await apiRequest<ListResponse>(`${source.list}${sep}status=pending&page=1&limit=100`);
        return { rows: res.items.map((item) => toRow(source, item)), total: res.total };
      },
    })),
  });

  const decide = useMutation({
    mutationFn: ({ row, status }: { row: Row; status: 'verified' | 'suspended' }) =>
      apiRequest(row.source.verify(row.id), { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: (_d, { row, status }) => {
      setRejecting(null);
      setError('');
      setNotice(status === 'verified' ? `${row.name} is verified and visible to patients.` : `${row.name} was rejected.`);
      void qc.invalidateQueries({ queryKey: ['verification-queue', row.kind] });
      void qc.invalidateQueries({ queryKey: ['ops-dashboard'] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const loading = results.some((r) => r.isLoading);
  const failed = results.filter((r) => r.isError);
  const counts = Object.fromEntries(SOURCES.map((s, i) => [s.kind, results[i]?.data?.total ?? 0])) as Record<Kind, number>;
  const allRows = results.flatMap((r) => r.data?.rows ?? []);
  const rows = tab === 'all' ? allRows : allRows.filter((r) => r.kind === tab);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Network / Verification"
        title="Verification queue"
        subtitle="Providers waiting for review. Approving makes them visible and bookable in the patient app; rejecting suspends the listing."
      />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={(id) => setTab(id as Kind | 'all')}
          items={[
            { id: 'all', label: 'All', count: total },
            ...SOURCES.filter((s) => counts[s.kind] > 0 || tab === s.kind).map((s) => ({
              id: s.kind,
              label: s.label,
              count: counts[s.kind],
            })),
          ]}
        />
      </div>
      {notice ? (
        <div className="mb-3 rounded-lg bg-[#ecfdf3] px-3 py-2 text-sm text-[#067647]" role="status">
          {notice}
        </div>
      ) : null}
      {failed.length > 0 ? <ErrorText>{(failed[0]!.error as Error).message}</ErrorText> : null}
      {error && !rejecting ? <ErrorText>{error}</ErrorText> : null}
      <Table headers={HEADERS}>
        {loading && allRows.length === 0 ? (
          <TableMessage colSpan={HEADERS.length}>
            <SkeletonRows rows={5} className="h-10" />
          </TableMessage>
        ) : rows.length === 0 && failed.length === 0 ? (
          <TableMessage colSpan={HEADERS.length}>
            <EmptyState
              icon={<IconBadgeCheck className="size-5" />}
              title="All caught up"
              body="No providers are waiting for verification."
            />
          </TableMessage>
        ) : (
          rows.map((row) => (
            <tr key={`${row.kind}-${row.id}`}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar initials={row.initials} src={row.photoUrl} />
                  <span className="font-medium">{row.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{row.source.singular}</td>
              <td className="px-4 py-3 text-[var(--muted)] max-w-[320px]">{row.detail || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap">{row.phone ?? '—'}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <div className="flex justify-end items-center gap-1.5">
                  <Link to={row.source.manage} className="px-2 text-sm text-[var(--brand)]">
                    Review profile
                  </Link>
                  {canWrite ? (
                    <>
                      <Button
                        variant="danger"
                        className="px-2.5 py-1.5"
                        onClick={() => {
                          setError('');
                          setNotice('');
                          setRejecting(row);
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        className="px-2.5 py-1.5"
                        disabled={decide.isPending}
                        onClick={() => {
                          setNotice('');
                          decide.mutate({ row, status: 'verified' });
                        }}
                      >
                        Approve
                      </Button>
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))
        )}
      </Table>

      <ConfirmDialog
        open={Boolean(rejecting)}
        title={`Reject ${rejecting?.name}?`}
        message="The listing is marked suspended and stays hidden from patients. You can verify it later from its profile page."
        confirmLabel="Reject"
        busyLabel="Rejecting…"
        busy={decide.isPending}
        error={error}
        onConfirm={() => rejecting && decide.mutate({ row: rejecting, status: 'suspended' })}
        onClose={() => {
          setRejecting(null);
          setError('');
        }}
      />
    </div>
  );
}
