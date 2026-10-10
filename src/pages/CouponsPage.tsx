import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { IconPlus, IconTag } from '../components/icons';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorText,
  PageHeader,
  SkeletonRows,
  StatusPill,
  Table,
  TableMessage,
  Tabs,
} from '../components/ui';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate, formatInr } from '../lib/format';
import { can } from '../lib/roles';
import { CouponForm, type Coupon } from './coupons/CouponForm';

const HEADERS = ['Code', 'Discount', 'Conditions', 'Usage', 'Validity', 'Status', ''];

/** Effective state: an active coupon can still be unusable (expired, scheduled, used up). */
function couponState(c: Coupon): { status: string; label: string } {
  const now = Date.now();
  if (!c.isActive) return { status: 'inactive', label: 'Inactive' };
  if (c.validUntil && new Date(c.validUntil).getTime() < now) return { status: 'expired', label: 'Expired' };
  if (c.maxUses !== null && c.uses >= c.maxUses) return { status: 'closed', label: 'Used up' };
  if (c.validFrom && new Date(c.validFrom).getTime() > now) return { status: 'scheduled', label: 'Scheduled' };
  return { status: 'active', label: 'Active' };
}

function discountText(c: Coupon) {
  if (c.discountType === 'percent') {
    return `${c.value}% off${c.maximumDiscount ? ` · up to ${formatInr(c.maximumDiscount)}` : ''}`;
  }
  return `${formatInr(c.value)} off`;
}

export function CouponsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canWrite = can(user?.role, 'finance');
  const [filter, setFilter] = useState<'all' | 'live' | 'inactive'>('all');
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const [deactivating, setDeactivating] = useState<Coupon | null>(null);
  const [error, setError] = useState('');

  const list = useQuery({ queryKey: ['coupons'], queryFn: () => apiRequest<Coupon[]>('/admin/coupons') });

  const setActive = useMutation({
    mutationFn: ({ coupon, isActive }: { coupon: Coupon; isActive: boolean }) =>
      apiRequest<Coupon>(`/admin/coupons/${coupon.id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
    onSuccess: () => {
      setDeactivating(null);
      setError('');
      void qc.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const all = list.data ?? [];
  const rows = all.filter((c) =>
    filter === 'all' ? true : filter === 'live' ? couponState(c).status === 'active' : !c.isActive,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Coupons"
        subtitle="Discount codes patients can apply when paying online."
        action={
          canWrite ? (
            <Button onClick={() => setEditing('new')}>
              <IconPlus className="size-4" />
              New coupon
            </Button>
          ) : null
        }
      />
      <div className="mb-4">
        <Tabs
          value={filter}
          onChange={(id) => setFilter(id as typeof filter)}
          items={[
            { id: 'all', label: 'All', count: all.length },
            { id: 'live', label: 'Live', count: all.filter((c) => couponState(c).status === 'active').length },
            { id: 'inactive', label: 'Inactive', count: all.filter((c) => !c.isActive).length },
          ]}
        />
      </div>
      {list.isError ? <ErrorText>{(list.error as Error).message}</ErrorText> : null}
      {error && !deactivating ? <ErrorText>{error}</ErrorText> : null}
      <Table headers={HEADERS}>
        {list.isLoading ? (
          <TableMessage colSpan={HEADERS.length}>
            <SkeletonRows rows={4} className="h-10" />
          </TableMessage>
        ) : list.data && rows.length === 0 ? (
          <TableMessage colSpan={HEADERS.length}>
            <EmptyState
              icon={<IconTag className="size-5" />}
              title={all.length === 0 ? 'No coupons yet' : 'No coupons in this view'}
              body={all.length === 0 ? 'Create a code to run a promotion or make good on a bad experience.' : undefined}
              action={
                all.length === 0 && canWrite ? <Button onClick={() => setEditing('new')}>New coupon</Button> : undefined
              }
            />
          </TableMessage>
        ) : (
          rows.map((c) => {
            const state = couponState(c);
            return (
              <tr key={c.id}>
                <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                <td className="px-4 py-3 whitespace-nowrap">{discountText(c)}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {c.minimumAmount ? `Orders over ${formatInr(c.minimumAmount)}` : 'Any amount'}
                </td>
                <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                  {c.uses}
                  {c.maxUses !== null ? ` / ${c.maxUses}` : ''}
                </td>
                <td className="px-4 py-3 text-[var(--muted)] whitespace-nowrap">
                  {c.validFrom || c.validUntil
                    ? `${c.validFrom ? formatDate(c.validFrom) : 'Now'} – ${c.validUntil ? formatDate(c.validUntil) : 'No end'}`
                    : 'Always'}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={state.status} label={state.label} />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {canWrite ? (
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => setEditing(c)}>
                        Edit
                      </Button>
                      {c.isActive ? (
                        <Button variant="danger" className="px-2.5 py-1.5" onClick={() => setDeactivating(c)}>
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          variant="soft"
                          className="px-2.5 py-1.5"
                          disabled={setActive.isPending}
                          onClick={() => setActive.mutate({ coupon: c, isActive: true })}
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })
        )}
      </Table>

      {editing ? (
        <CouponForm
          key={editing === 'new' ? 'new' : editing.id}
          coupon={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deactivating)}
        title={`Deactivate ${deactivating?.code}?`}
        message="Patients can no longer apply this code. Payments that already used it are not affected, and you can reactivate it later."
        confirmLabel="Deactivate"
        busyLabel="Deactivating…"
        busy={setActive.isPending}
        error={error}
        onConfirm={() => deactivating && setActive.mutate({ coupon: deactivating, isActive: false })}
        onClose={() => {
          setDeactivating(null);
          setError('');
        }}
      />
    </div>
  );
}
