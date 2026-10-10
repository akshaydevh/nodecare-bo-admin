/**
 * Mirrors core-backend/src/modules/admin/admin-roles.ts so the console can hide
 * actions an operator is not allowed to take. The API still enforces these.
 */
type Capability = 'network' | 'bookings' | 'finance' | 'cms' | 'userStatus' | 'settings' | 'team';

const CAPABILITIES: Record<Capability, readonly string[]> = {
  network: ['root', 'admin'],
  bookings: ['root', 'admin', 'support'],
  finance: ['root', 'admin', 'finance'],
  cms: ['root', 'admin'],
  userStatus: ['root', 'admin'],
  settings: ['root'],
  team: ['root'],
};

export function can(role: string | undefined, capability: Capability): boolean {
  return Boolean(role && CAPABILITIES[capability].includes(role));
}
