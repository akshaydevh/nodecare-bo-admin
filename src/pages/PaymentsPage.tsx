import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { IconAlert, IconCard, IconClock, IconCurrency, IconDownload } from '../components/icons';
import {
  Button,
  EmptyState,
  ErrorText,
  Input,
  KpiCard,
  PageHeader,
  Pagination,
  Select,
  SkeletonRows,
  StatusPill,
  Table,
  TableMessage,
} from '../components/ui';
import { apiRequestWithMeta, qs } from '../lib/api';
import { downloadCsv } from '../lib/csv';
import { formatDateTime, formatInr, formatInrCompact } from '../lib/format';
import { PaymentDrawer } from './payments/PaymentDrawer';
import { paymentPill, RESOURCE_LABEL, type Payment, type PaymentsMeta } from './payments/payment-types';

const HEADERS = ['Receipt', 'Customer', 'For', 'Amount', 'Status', 'Created', ''];
const LIMIT = 25;

export function PaymentsPage() {
  const [status, setStatus] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['payments', status, resourceType, q, from, to, page],
    queryFn: () =>
      apiRequestWithMeta<Payment[], PaymentsMeta>(
        `/admin/payments${qs({ status, resourceType, q: q.trim(), from, to, page, limit: LIMIT })}`,
      ),
    placeholderData: keepPreviousData,
  });

  const items = list.data?.data ?? [];
  const meta = list.data?.meta;
  const summary = meta?.summary;
  const selected = items.find((p) => p.id === selectedId) ?? null;
  const rangeInvalid = Boolean(from && to && to < from);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(1);
      setter(v);
    };
  }

  function exportPage() {
    downloadCsv(
      `payments-page-${meta?.page ?? 1}.csv`,
      ['Receipt', 'Customer', 'Phone', 'For', 'Amount', 'Discount', 'Coupon', 'Status', 'Refunded', 'Refund status', 'Gateway order', 'Gateway payment', 'Created', 'Paid at'],
      items.map((p) => [
        p.receipt,
        p.customer.name,
        p.customer.phone,
        RESOURCE_LABEL[p.resourceType],
        p.amount,
        p.discountAmount,
        p.couponCode,
        p.status,
        p.refundAmount,
        p.refundStatus,
        p.gatewayOrderId,
        p.gatewayPaymentId,
        p.createdAt,
        p.paidAt,
      ]),
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        subtitle="Online payments collected through Razorpay. Pay-at-clinic visits are settled at the clinic and do not appear here."
        action={
          <Button variant="ghost" onClick={exportPage} disabled={items.length === 0}>
            <IconDownload className="size-4" />
            Export this page
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <KpiCard
          label="Collected"
          value={summary ? formatInrCompact(summary.collected) : '—'}
          hint={summary ? `${summary.paidCount} paid · net ${formatInr(summary.collected - summary.refunded)}` : undefined}
          icon={<IconCurrency className="size-5" />}
        />
        <KpiCard
          label="Refunded"
          value={summary ? formatInrCompact(summary.refunded) : '—'}
          hint="Including partial refunds"
          icon={<IconCard className="size-5" />}
          iconClassName="bg-[#f4f3ff] text-[#5925dc]"
        />
        <KpiCard
          label="Awaiting payment"
          value={summary ? String(summary.pendingCount) : '—'}
          hint="Checkout started, not completed"
          icon={<IconClock className="size-5" />}
          iconClassName="bg-[#fffaeb] text-[#b54708]"
        />
        <KpiCard
          label="Failed"
          value={summary ? String(summary.failedCount) : '—'}
          tone={summary && summary.failedCount > 0 ? 'alert' : undefined}
          hint={summary && summary.failedCount > 0 ? 'Check gateway failure reasons' : 'No failures'}
          icon={<IconAlert className="size-5" />}
          iconClassName="bg-[#fef3f2] text-[var(--danger)]"
        />
      </div>
      <p className="-mt-3 mb-5 text-xs text-[var(--muted)]">Totals reflect the filters below.</p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <Input
          aria-label="Search payments"
          placeholder="Receipt, Razorpay order or payment ID"
          value={q}
          onChange={(e) => resetPage(setQ)(e.target.value)}
          className="max-w-xs"
        />
        <Select
          aria-label="Payment status"
          value={status}
          onChange={(e) => resetPage(setStatus)(e.target.value)}
          className="max-w-[170px]"
        >
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="created">Awaiting payment</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </Select>
        <Select
          aria-label="Payment for"
          value={resourceType}
          onChange={(e) => resetPage(setResourceType)(e.target.value)}
          className="max-w-[210px]"
        >
          <option value="">All services</option>
          {Object.entries(RESOURCE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          From
          <Input type="date" value={from} max={to || undefined} onChange={(e) => resetPage(setFrom)(e.target.value)} className="w-[150px]" />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          To
          <Input type="date" value={to} min={from || undefined} onChange={(e) => resetPage(setTo)(e.target.value)} className="w-[150px]" />
        </label>
        {status || resourceType || q || from || to ? (
          <Button
            variant="ghost"
            onClick={() => {
              setStatus('');
              setResourceType('');
              setQ('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>
      {rangeInvalid ? <ErrorText>The end date is before the start date.</ErrorText> : null}
      {list.isError ? <ErrorText>{(list.error as Error).message}</ErrorText> : null}

      <Table headers={HEADERS}>
        {list.isLoading ? (
          <TableMessage colSpan={HEADERS.length}>
            <SkeletonRows rows={6} className="h-10" />
          </TableMessage>
        ) : items.length === 0 ? (
          <TableMessage colSpan={HEADERS.length}>
            <EmptyState
              icon={<IconCard className="size-5" />}
              title="No payments found"
              body="Online payments appear here once a patient checks out with Razorpay."
            />
          </TableMessage>
        ) : (
          items.map((p) => {
            const pill = paymentPill(p);
            return (
              <tr
                key={p.id}
                className={`cursor-pointer ${selectedId === p.id ? 'bg-[var(--brand-soft)]' : 'hover:bg-[#f8fafb]'}`}
                onClick={() => setSelectedId(p.id)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{p.receipt}</div>
                  <div className="text-xs text-[var(--muted)] font-mono">{p.gatewayPaymentId ?? p.gatewayOrderId}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{p.customer.name ?? '—'}</div>
                  <div className="text-xs text-[var(--muted)]">{p.customer.phone ?? ''}</div>
                </td>
                <td className="px-4 py-3">{RESOURCE_LABEL[p.resourceType]}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-medium tabular-nums">{formatInr(p.amount)}</div>
                  {p.discountAmount > 0 ? (
                    <div className="text-xs text-[var(--muted)]">
                      −{formatInr(p.discountAmount)} {p.couponCode ?? ''}
                    </div>
                  ) : null}
                  {p.refundAmount ? (
                    <div className="text-xs text-[#5925dc]">Refund {formatInr(p.refundAmount)}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={pill.status} label={pill.label} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]">{formatDateTime(p.createdAt)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-[var(--brand)] text-sm"
                    aria-label={`Open payment ${p.receipt}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(p.id);
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            );
          })
        )}
      </Table>
      {meta && meta.total > 0 ? (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPage={setPage} />
      ) : null}

      <PaymentDrawer payment={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
