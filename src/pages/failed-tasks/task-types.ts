import type { PageMeta } from '../../lib/api';

/**
 * One piece of background work the backend could not finish: a handler's
 * attempt at one event (see core-backend/src/events/delivery.model.ts).
 */
export type FailedTask = {
  /** `<eventId>.<handler>` */
  id: string;
  eventId: string;
  event: string;
  handler: string;
  /** `dead` has used up its retries; `pending` is still being retried; `done` only after a retry here. */
  status: 'dead' | 'pending' | 'done';
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  occurredAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
};

export type FailedTasksMeta = PageMeta & { dead: number; retrying: number };

export type TaskKind = 'refund' | 'payment' | 'notification' | 'other';

/** What each backend handler does, in the words an operator would use. */
const TASKS: Record<string, { label: string; kind: TaskKind }> = {
  refund: { label: 'Refund to the customer', kind: 'refund' },
  'appointment-refund': { label: 'Refund for a cancelled appointment', kind: 'refund' },
  'payment-settle': { label: 'Record a completed payment', kind: 'payment' },
  'razorpay-webhook': { label: 'Payment update from Razorpay', kind: 'payment' },
  'notification-push': { label: 'Push notification', kind: 'notification' },
  'notification-email': { label: 'Email', kind: 'notification' },
  'announcement-broadcast': { label: 'Broadcast to users', kind: 'notification' },
  'appointment-notifications': { label: 'Appointment notification', kind: 'notification' },
  'lab-booking-created-notification': { label: 'Lab booking confirmation', kind: 'notification' },
  'lab-booking-status-notification': { label: 'Lab booking update', kind: 'notification' },
  'pharmacy-order-created-notification': { label: 'Medicine order confirmation', kind: 'notification' },
  'pharmacy-order-status-notification': { label: 'Medicine order update', kind: 'notification' },
  'payment-settled-notification': { label: 'Payment receipt', kind: 'notification' },
  'refund-initiated-notification': { label: 'Refund notice', kind: 'notification' },
  'support-ticket-created-notification': { label: 'Support ticket confirmation', kind: 'notification' },
  'support-reply-notification': { label: 'Support reply notice', kind: 'notification' },
  'support-ticket-updated-notification': { label: 'Support ticket update', kind: 'notification' },
};

function words(value: string) {
  const text = value.replace(/[-_.]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function describeTask(task: Pick<FailedTask, 'handler'>): { label: string; kind: TaskKind } {
  return TASKS[task.handler] ?? { label: words(task.handler), kind: 'other' };
}

export const KIND_LABEL: Record<TaskKind, string> = {
  refund: 'Refund',
  payment: 'Payment',
  notification: 'Notification',
  other: 'Other',
};

/** Tones from the shared StatusPill palette. */
export const KIND_PILL: Record<TaskKind, string> = {
  refund: 'high',
  payment: 'held',
  notification: 'booked',
  other: 'normal',
};

const RESOURCE_LABEL: Record<string, string> = {
  appointment: 'Appointment',
  lab_booking: 'Lab booking',
  pharmacy_order: 'Medicine order',
};

const FIELD_LABEL: Record<string, string> = {
  paymentId: 'Payment',
  appointmentId: 'Appointment',
  bookingId: 'Lab booking',
  orderId: 'Medicine order',
  ticketId: 'Support ticket',
  notificationId: 'Notification',
  webhookId: 'Razorpay update',
  userId: 'Account',
  audience: 'Audience',
  title: 'Title',
  body: 'Message',
  status: 'Status',
  actor: 'Changed by',
  amount: 'Amount',
  reason: 'Reason',
  replyIndex: 'Reply number',
};

export type TaskField = { label: string; value: string; isId: boolean };

function isRecordId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

/** The event's details as labelled rows, with the record it concerns first. */
export function taskFields(task: Pick<FailedTask, 'payload'>): TaskField[] {
  const payload = task.payload ?? {};
  const fields: TaskField[] = [];
  const { resourceType, resourceId, ...rest } = payload;
  if (typeof resourceType === 'string' && typeof resourceId === 'string') {
    fields.push({ label: RESOURCE_LABEL[resourceType] ?? words(resourceType), value: resourceId, isId: true });
  }
  for (const [key, value] of Object.entries(rest)) {
    if (value === null || value === undefined || value === '') continue;
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    fields.push({ label: FIELD_LABEL[key] ?? words(key), value: text, isId: isRecordId(value) });
  }
  return fields;
}

/** A one-line "what is this about" for the list: the first record the event names. */
export function taskSubject(task: Pick<FailedTask, 'payload'>): TaskField | null {
  const fields = taskFields(task);
  return fields.find((field) => field.isId) ?? fields[0] ?? null;
}

/** Record ids are long; the last six characters are enough to tell rows apart. */
export function shortId(value: string) {
  return value.length > 8 ? `…${value.slice(-6)}` : value;
}

/** The recorded reason, or null when the backend saved nothing readable. */
export function taskError(task: Pick<FailedTask, 'lastError'>): string | null {
  const text = task.lastError?.trim();
  if (!text || text === '[object Object]') return null;
  return text;
}

/** What to check before retrying, for failures with a known cause. */
export function taskAdvice(task: Pick<FailedTask, 'handler' | 'lastError'>): string | null {
  const { kind } = describeTask(task);
  const error = task.lastError ?? '';
  if (kind === 'refund') {
    if (/invalid request sent/i.test(error) || !taskError(task)) {
      return 'Razorpay can reject a refund when the account balance is too low to cover it. Check the balance in the Razorpay dashboard before retrying.';
    }
    return 'The customer has not been refunded yet. Check the payment in the Razorpay dashboard before retrying.';
  }
  if (kind === 'payment') {
    return 'Check the payment in the Razorpay dashboard, then retry so the booking shows the right payment status.';
  }
  return null;
}
