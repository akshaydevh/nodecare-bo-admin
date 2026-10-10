export type Payment = {
  id: string;
  receipt: string;
  resourceType: 'appointment' | 'lab_booking' | 'pharmacy_order' | 'ambulance_booking';
  resourceId: string;
  gateway: string;
  gatewayOrderId: string;
  gatewayPaymentId: string | null;
  amount: number;
  discountAmount: number;
  couponCode: string | null;
  status: 'created' | 'paid' | 'failed' | 'refunded';
  failureReason: string | null;
  refundAmount: number | null;
  refundStatus: 'pending' | 'processed' | 'failed' | null;
  refundReason: string | null;
  paidAt: string | null;
  createdAt: string;
  customer: { name: string | null; phone: string | null };
};

export type PaymentSummary = {
  collected: number;
  refunded: number;
  paidCount: number;
  failedCount: number;
  pendingCount: number;
};

export type PaymentsMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: PaymentSummary;
};

export const RESOURCE_LABEL: Record<Payment['resourceType'], string> = {
  appointment: 'Doctor / caretaker visit',
  lab_booking: 'Lab test',
  pharmacy_order: 'Medicines',
  ambulance_booking: 'Ambulance',
};

export const PAYMENT_STATUS_LABEL: Record<Payment['status'], string> = {
  created: 'Awaiting payment',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

export function isRefundable(p: Payment) {
  return p.status === 'paid' && !p.refundStatus;
}

/** Status pill key: a paid payment with a pending refund reads as refund pending. */
export function paymentPill(p: Payment): { status: string; label: string } {
  if (p.refundStatus === 'pending') return { status: 'pending', label: 'Refund pending' };
  if (p.refundStatus === 'failed') return { status: 'failed', label: 'Refund failed' };
  if (p.status === 'refunded' && p.refundAmount !== null && p.refundAmount < p.amount) {
    return { status: 'partially refunded', label: 'Partially refunded' };
  }
  return { status: p.status, label: PAYMENT_STATUS_LABEL[p.status] };
}
