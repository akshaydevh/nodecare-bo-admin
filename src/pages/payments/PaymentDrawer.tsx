import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  ConfirmDialog,
  DetailRow,
  Drawer,
  ErrorText,
  FieldLabel,
  Input,
  StatusPill,
  Textarea,
} from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateTime, formatInr } from '../../lib/format';
import { can } from '../../lib/roles';
import { isRefundable, paymentPill, RESOURCE_LABEL, type Payment } from './payment-types';

function RefundForm({ payment, onDone }: { payment: Payment; onDone: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<'full' | 'partial'>('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const partialAmount = Number(amount);
  const refundAmount = kind === 'full' ? payment.amount : partialAmount;
  const amountValid =
    kind === 'full' || (Number.isFinite(partialAmount) && partialAmount > 0 && partialAmount <= payment.amount);
  const reasonValid = reason.trim().length >= 3;

  const refund = useMutation({
    mutationFn: () =>
      apiRequest<{ id: string; refundStatus: string | null; refundAmount: number | null }>(
        `/admin/payments/${payment.id}/refund`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason: reason.trim(),
            ...(kind === 'partial' ? { amount: Math.round(partialAmount * 100) / 100 } : {}),
          }),
        },
      ),
    onSuccess: (result) => {
      if (!result.refundStatus) {
        setError('The gateway did not start a refund for this payment (no captured gateway payment ID).');
        return;
      }
      setConfirming(false);
      void qc.invalidateQueries({ queryKey: ['payments'] });
      void qc.invalidateQueries({ queryKey: ['ops-bookings'] });
      onDone();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        if (amountValid && reasonValid) setConfirming(true);
      }}
    >
      <div className="text-[15px] font-semibold">Issue a refund</div>
      <fieldset className="flex gap-2" aria-label="Refund amount type">
        {(['full', 'partial'] as const).map((k) => (
          <label
            key={k}
            className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm ${
              kind === k ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]' : 'border-[var(--line)]'
            }`}
          >
            <input
              type="radio"
              name="refund-kind"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
              className="sr-only"
            />
            <span className="font-medium">{k === 'full' ? 'Full refund' : 'Partial refund'}</span>
            <span className="block text-xs text-[var(--muted)]">
              {k === 'full' ? formatInr(payment.amount) : 'Choose an amount'}
            </span>
          </label>
        ))}
      </fieldset>
      {kind === 'partial' ? (
        <div>
          <FieldLabel htmlFor="refund-amount" hint={`(max ${formatInr(payment.amount)})`}>
            Amount (₹)
          </FieldLabel>
          <Input
            id="refund-amount"
            type="number"
            inputMode="decimal"
            min={1}
            max={payment.amount}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          {amount && !amountValid ? (
            <ErrorText>Enter an amount between ₹1 and {formatInr(payment.amount)}.</ErrorText>
          ) : null}
        </div>
      ) : null}
      <div>
        <FieldLabel htmlFor="refund-reason" hint="(kept in the audit log)">
          Reason
        </FieldLabel>
        <Textarea
          id="refund-reason"
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Doctor cancelled, patient charged twice"
          className="min-h-[72px]"
          required
        />
      </div>
      <Button type="submit" variant="danger" disabled={!amountValid || !reasonValid}>
        Review refund
      </Button>

      <ConfirmDialog
        open={confirming}
        title={`Refund ${formatInr(refundAmount || 0)}?`}
        message={
          <>
            {formatInr(refundAmount || 0)} of {formatInr(payment.amount)} goes back to{' '}
            <span className="font-medium text-[var(--ink)]">{payment.customer.name ?? 'the customer'}</span> on the
            original payment method via {payment.gateway === 'mock' ? 'the mock gateway' : 'Razorpay'}. The customer is
            notified and the booking is marked refunded. A payment can be refunded only once.
          </>
        }
        confirmLabel="Refund now"
        busyLabel="Refunding…"
        busy={refund.isPending}
        error={error}
        onConfirm={() => refund.mutate()}
        onClose={() => {
          setConfirming(false);
          setError('');
        }}
      />
    </form>
  );
}

export function PaymentDrawer({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const { user } = useAuth();
  const pill = payment ? paymentPill(payment) : null;
  return (
    <Drawer
      open={Boolean(payment)}
      title={payment ? payment.receipt : 'Payment'}
      subtitle={payment ? RESOURCE_LABEL[payment.resourceType] : undefined}
      onClose={onClose}
    >
      {payment && pill ? (
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[13px] text-[var(--muted)]">Amount charged</div>
              <div className="text-[28px] font-semibold tracking-tight">{formatInr(payment.amount)}</div>
            </div>
            <StatusPill status={pill.status} label={pill.label} />
          </div>

          <Card className="p-4! divide-y divide-[var(--line)]">
            <DetailRow label="Customer">
              {payment.customer.name ?? '—'}
              {payment.customer.phone ? (
                <div className="text-xs font-normal text-[var(--muted)]">{payment.customer.phone}</div>
              ) : null}
            </DetailRow>
            <DetailRow label="For">
              {RESOURCE_LABEL[payment.resourceType]}
              {payment.resourceType === 'appointment' ? (
                <div>
                  <Link
                    to={`/bookings?booking=${payment.resourceId}`}
                    className="text-xs font-normal text-[var(--brand)]"
                  >
                    Open booking
                  </Link>
                </div>
              ) : null}
            </DetailRow>
            {payment.discountAmount > 0 ? (
              <DetailRow label="Discount">
                −{formatInr(payment.discountAmount)}
                {payment.couponCode ? ` (${payment.couponCode})` : ''}
              </DetailRow>
            ) : null}
            <DetailRow label="Created">{formatDateTime(payment.createdAt)}</DetailRow>
            <DetailRow label="Paid at">{formatDateTime(payment.paidAt)}</DetailRow>
            {payment.failureReason ? <DetailRow label="Failure">{payment.failureReason}</DetailRow> : null}
          </Card>

          <Card className="p-4! divide-y divide-[var(--line)]">
            <DetailRow label="Gateway">
              <span className="capitalize">{payment.gateway}</span>
            </DetailRow>
            <DetailRow label="Order ID">
              <span className="font-mono text-xs">{payment.gatewayOrderId}</span>
            </DetailRow>
            <DetailRow label="Payment ID">
              <span className="font-mono text-xs">{payment.gatewayPaymentId ?? '—'}</span>
            </DetailRow>
          </Card>

          {payment.refundStatus ? (
            <Card className="p-4! divide-y divide-[var(--line)]">
              <DetailRow label="Refund">
                {formatInr(payment.refundAmount ?? 0)} · <span className="capitalize">{payment.refundStatus}</span>
              </DetailRow>
              {payment.refundReason ? <DetailRow label="Reason">{payment.refundReason}</DetailRow> : null}
            </Card>
          ) : null}

          {isRefundable(payment) && can(user?.role, 'finance') ? (
            <RefundForm key={payment.id} payment={payment} onDone={onClose} />
          ) : isRefundable(payment) ? (
            <p className="text-sm text-[var(--muted)]">Refunds need a Finance, Ops Admin or Super Admin role.</p>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
