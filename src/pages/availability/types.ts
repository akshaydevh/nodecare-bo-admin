import { qs } from '../../lib/api';

/** Backend ProviderType: caretakers are stored as `nurse`. */
export type ProviderType = 'doctor' | 'nurse' | 'clinic' | 'hospital';

export const PROVIDER_TYPE_LABEL: Record<ProviderType, string> = {
  doctor: 'Doctor',
  nurse: 'Caretaker',
  clinic: 'Clinic',
  hospital: 'Hospital',
};

export type Target = { providerType: ProviderType; providerId: string };

export type FacilityRef = { type: 'clinic' | 'hospital'; id: string; name: string };

export type TargetInfo = {
  providerType: ProviderType;
  providerId: string;
  name: string;
  photoUrl: string | null;
  facilities: FacilityRef[];
  lockedFacility: FacilityRef | null;
  defaultSlotMinutes: number;
};

export type TimeWindow = { start: string; end: string };

export type Rule = {
  id: string;
  facilityType: 'clinic' | 'hospital' | null;
  facilityId: string | null;
  facilityName: string | null;
  kind: 'weekly' | 'date_range';
  label: string | null;
  daysOfWeek: number[];
  startDate: string | null;
  endDate: string | null;
  windows: TimeWindow[];
  slotMinutes: number;
  fee: number | null;
  isActive: boolean;
  summary: string;
  editable: boolean;
};

export type RulesResponse = { target: TargetInfo; rules: Rule[] };

export type CalendarDay = {
  date: string;
  weekday: string;
  closed: boolean;
  closedReason: string | null;
  available: number;
  booked: number;
  blocked: number;
  total: number;
  pendingRequests: number;
};

export type CalendarResponse = { target: TargetInfo; from: string; to: string; days: CalendarDay[] };

export type Slot = {
  id: string;
  facilityName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'held' | 'booked' | 'blocked';
  consultationFee: number;
  source: 'rule' | 'manual' | null;
  blockedBy: string | null;
  isPast: boolean;
  booking: { id: string; bookingId: string; status: string; patientName: string | null } | null;
};

export type DayResponse = {
  target: TargetInfo;
  date: string;
  closed: boolean;
  closedReason: string | null;
  slots: Slot[];
};

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function targetQs(target: Target, extra: Record<string, string | number | undefined> = {}) {
  return qs({ providerType: target.providerType, providerId: target.providerId, ...extra });
}

export function availabilityKey(target: Target) {
  return ['availability', target.providerType, target.providerId] as const;
}

/** YYYY-MM-DD helpers that never touch the local timezone. */
export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function monthBounds(year: number, month: number) {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(last)}` };
}

export function weekdayOf(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export function minutesOf(time: string) {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Client-side mirror of the backend window validation. */
export function windowsError(windows: TimeWindow[]): string | null {
  if (windows.length === 0) return 'Add at least one time window';
  for (const w of windows) {
    if (!w.start || !w.end) return 'Fill in every start and end time';
    if (minutesOf(w.end) <= minutesOf(w.start)) return 'Each window must end after it starts';
  }
  const sorted = [...windows].sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (minutesOf(sorted[i]!.start) < minutesOf(sorted[i - 1]!.end)) return 'Time windows overlap';
  }
  return null;
}

export const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60, 90, 120];
