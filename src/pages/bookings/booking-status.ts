export type BookingService = 'doctor' | 'diagnostics' | 'pharmacy' | 'ambulance' | 'caretaker';

type StatusOption = { value: string; label: string };

/** Doctor and caretaker visits share the appointment lifecycle. */
export const APPOINTMENT_STATUSES: StatusOption[] = [
  { value: 'pending', label: 'Awaiting provider' },
  { value: 'confirmed', label: 'Accepted' },
  { value: 'rejected', label: 'Declined' },
  { value: 'expired', label: 'Request expired' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_show', label: 'No-show' },
];

const LAB_STATUSES: StatusOption[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sample_collected', label: 'Sample collected' },
  { value: 'processing', label: 'Processing' },
  { value: 'report_ready', label: 'Report ready' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PHARMACY_STATUSES: StatusOption[] = [
  { value: 'placed', label: 'Placed' },
  { value: 'prescription_review', label: 'Prescription review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packing', label: 'Packing' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const AMBULANCE_STATUSES: StatusOption[] = [
  { value: 'requested', label: 'Requested' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'en_route', label: 'En route' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function statusGroupsFor(service: BookingService | ''): { label: string; options: StatusOption[] }[] {
  switch (service) {
    case 'doctor':
    case 'caretaker':
      return [{ label: 'Visit', options: APPOINTMENT_STATUSES }];
    case 'diagnostics':
      return [{ label: 'Diagnostics', options: LAB_STATUSES }];
    case 'pharmacy':
      return [{ label: 'Pharmacy', options: PHARMACY_STATUSES }];
    case 'ambulance':
      return [{ label: 'Ambulance', options: AMBULANCE_STATUSES }];
    default:
      return [
        { label: 'Doctor & caretaker visits', options: APPOINTMENT_STATUSES },
        { label: 'Diagnostics', options: LAB_STATUSES },
        { label: 'Pharmacy', options: PHARMACY_STATUSES },
        { label: 'Ambulance', options: AMBULANCE_STATUSES },
      ];
  }
}

export function isAppointmentService(service: string) {
  return service === 'doctor' || service === 'caretaker';
}

/** Human label for a booking status, using appointment wording where relevant. */
export function bookingStatusLabel(service: string, status: string): string {
  if (isAppointmentService(service)) {
    const match = APPOINTMENT_STATUSES.find((s) => s.value === status);
    if (match) return match.label;
  }
  return status.replace(/_/g, ' ');
}

/** Pill tone key for StatusPill (appointment "pending" reads as awaiting provider). */
export function bookingStatusTone(service: string, status: string): string {
  if (isAppointmentService(service) && status === 'pending') return 'awaiting provider';
  return status;
}

const TERMINAL = new Set([
  'completed',
  'cancelled',
  'no_show',
  'rejected',
  'expired',
  'delivered',
  'report_ready',
]);

export function isTerminalStatus(status: string) {
  return TERMINAL.has(status);
}

export function paymentStatusLabel(status: string) {
  if (status === 'not_required') return 'Not required';
  return status.replace(/_/g, ' ');
}

export function paymentModeLabel(mode: string | null | undefined) {
  if (!mode) return null;
  if (mode === 'pay_at_clinic') return 'Pay at clinic';
  if (mode === 'online') return 'Online (Razorpay)';
  return mode.replace(/_/g, ' ');
}
