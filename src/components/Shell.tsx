import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  BrandLockup,
  IconAmbulance,
  IconApps,
  IconBarChart,
  IconBell,
  IconBuilding,
  IconCalendar,
  IconCaretaker,
  IconChevron,
  IconLab,
  IconLayout,
  IconLogout,
  IconPharmacy,
  IconSearch,
  IconSettings,
  IconShield,
  IconStethoscope,
  IconUser,
  IconUsers,
} from './icons';

type ProviderCounts = { ambulance: number; pharmacy: number; caretaker: number };

type Summary = {
  doctors: number;
  medicalCentres: number;
  centres: number;
  serviceProviders: number;
  bookings: number;
  ambulancesActive: number;
  providers?: ProviderCounts;
};

type CountKey = keyof Summary | keyof ProviderCounts;

type NavItem = { to: string; label: string; end?: boolean; countKey?: CountKey; icon: ReactNode };

const nav: {
  label: string;
  collapsible?: boolean;
  items: NavItem[];
}[] = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', end: true, icon: <IconLayout className="size-4" /> }],
  },
  {
    label: 'Network',
    collapsible: true,
    items: [
      { to: '/doctors', label: 'Doctors', countKey: 'doctors', icon: <IconStethoscope className="size-4" /> },
      { to: '/medical-centres', label: 'Medical Centres', countKey: 'medicalCentres', icon: <IconBuilding className="size-4" /> },
      { to: '/centres', label: 'Diagnostic Centres', countKey: 'centres', icon: <IconLab className="size-4" /> },
      { to: '/providers/ambulance', label: 'Ambulances', countKey: 'ambulance', icon: <IconAmbulance className="size-4" /> },
      { to: '/providers/pharmacy', label: 'Pharmacies', countKey: 'pharmacy', icon: <IconPharmacy className="size-4" /> },
      { to: '/providers/caretaker', label: 'Caretakers', countKey: 'caretaker', icon: <IconCaretaker className="size-4" /> },
    ],
  },
  {
    label: 'Operations',
    collapsible: true,
    items: [
      { to: '/bookings', label: 'Bookings', countKey: 'bookings', icon: <IconCalendar className="size-4" /> },
      { to: '/patients', label: 'Patients', icon: <IconUser className="size-4" /> },
      { to: '/reports', label: 'Reports & Sales', icon: <IconBarChart className="size-4" /> },
    ],
  },
  {
    label: 'App Configuration',
    collapsible: true,
    items: [
      { to: '/app-config/home', label: 'Home Content', icon: <IconApps className="size-4" /> },
      { to: '/app-config/discovery', label: 'Discovery', icon: <IconSearch className="size-4" /> },
      { to: '/app-config/diagnostics', label: 'Diagnostics', icon: <IconLab className="size-4" /> },
      { to: '/app-config/pharmacy', label: 'Pharmacy', icon: <IconBuilding className="size-4" /> },
      { to: '/app-config/testimonials', label: 'Testimonials', icon: <IconUsers className="size-4" /> },
      { to: '/app-config/support', label: 'Patient Support', icon: <IconBell className="size-4" /> },
    ],
  },
  {
    label: 'Administration',
    collapsible: true,
    items: [
      { to: '/onboarding', label: 'Provider Access', icon: <IconShield className="size-4" /> },
      { to: '/team', label: 'Team & Roles', icon: <IconShield className="size-4" /> },
      { to: '/settings', label: 'Settings', icon: <IconSettings className="size-4" /> },
    ],
  },
];

const NAV_COLLAPSED_KEY = 'nod-ops-nav-collapsed';

function readCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_COLLAPSED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as Record<string, boolean>;
  } catch {
    /* ignore */
  }
  return {};
}

function writeCollapsed(next: Record<string, boolean>) {
  localStorage.setItem(NAV_COLLAPSED_KEY, JSON.stringify(next));
}

function resolveCount(counts: Summary | undefined, countKey?: CountKey) {
  if (!counts || !countKey) return undefined;
  if (countKey === 'ambulance' || countKey === 'pharmacy' || countKey === 'caretaker') {
    return counts.providers?.[countKey];
  }
  const value = counts[countKey];
  return typeof value === 'number' ? value : undefined;
}

function groupContainsPath(items: NavItem[], pathname: string) {
  return items.some((item) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
}

function initials(name?: string | null) {
  if (!name) return 'AD';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function roleLabel(role?: string) {
  if (role === 'root') return 'Super Admin';
  if (role === 'admin') return 'Ops Admin';
  if (role === 'support') return 'Support';
  if (role === 'finance') return 'Finance';
  if (!role) return 'Operator';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function NavGroup({
  group,
  counts,
  pathname,
}: {
  group: (typeof nav)[number];
  counts: Summary | undefined;
  pathname: string;
}) {
  const hasActive = groupContainsPath(group.items, pathname);
  const [collapsed, setCollapsed] = useState(() => {
    if (!group.collapsible) return false;
    return readCollapsed()[group.label] === true;
  });

  useEffect(() => {
    if (hasActive) setCollapsed(false);
  }, [pathname, hasActive]);

  function toggle() {
    if (!group.collapsible) return;
    setCollapsed((current) => {
      const next = !current;
      writeCollapsed({ ...readCollapsed(), [group.label]: next });
      return next;
    });
  }

  const links = (
    <div className="space-y-0.5">
      {group.items.map((item) => {
        const count = resolveCount(counts, item.countKey);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end ?? false}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition ${
                isActive
                  ? 'bg-[var(--brand)] font-medium text-white'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <span className="opacity-90">{item.icon}</span>
            <span className="flex-1 truncate">{item.label}</span>
            {count !== undefined ? (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums text-white/70">
                {count}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </div>
  );

  if (!group.collapsible) {
    return (
      <div>
        <div className="px-3 mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--sidebar-muted)]">
          {group.label}
        </div>
        {links}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-2 px-3 mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--sidebar-muted)] hover:text-white/90 cursor-pointer"
      >
        <span className="flex-1 text-left truncate">{group.label}</span>
        <IconChevron
          className={`size-3.5 shrink-0 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ${collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}
      >
        <div className="overflow-hidden">{links}</div>
      </div>
    </div>
  );
}

export function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const summary = useQuery({
    queryKey: ['ops-summary'],
    queryFn: () => apiRequest<Summary>('/admin/ops/summary'),
    refetchInterval: 30_000,
  });

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  const counts = summary.data;

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr] bg-[var(--surface)]">
      <aside className="sticky top-0 h-screen bg-[var(--sidebar)] text-white flex flex-col">
        <div className="px-5 py-6">
          <BrandLockup inverted />
        </div>
        <nav className="flex-1 px-3 pb-3 space-y-5 overflow-y-auto">
          {nav.map((group) => (
            <NavGroup key={group.label} group={group} counts={counts} pathname={location.pathname} />
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 flex items-center gap-3">
          <span className="size-9 rounded-full bg-white/10 grid place-items-center text-[11px] font-semibold">
            {initials(user?.name || user?.username)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm truncate font-medium">{user?.name || user?.username || 'Admin'}</div>
            <div className="text-[11px] text-[var(--sidebar-muted)] truncate">{roleLabel(user?.role)}</div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="size-8 rounded-lg grid place-items-center text-white/60 hover:bg-white/10 hover:text-white"
            title="Sign out"
          >
            <IconLogout className="size-4" />
          </button>
        </div>
      </aside>
      <div className="flex flex-col min-w-0">
        <header className="h-16 px-8 flex items-center gap-4">
          <form onSubmit={onSearch} className="relative flex-1 max-w-2xl">
            <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#98a2b3]" />
            <input
              placeholder="Search doctors, centres, providers, bookings..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-xl bg-[#eef1f4] border-0 pl-10 pr-4 py-2.5 text-sm placeholder:text-[#98a2b3] outline-none focus:ring-2 focus:ring-[var(--brand)]/25"
            />
          </form>
          {typeof counts?.ambulancesActive === 'number' && counts.ambulancesActive > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs rounded-full bg-[#fef3f2] text-[var(--danger)] px-3 py-1.5 font-medium whitespace-nowrap">
              <span className="size-1.5 rounded-full bg-[var(--danger)]" />
              {counts.ambulancesActive} ambulance{counts.ambulancesActive === 1 ? '' : 's'} active
            </span>
          ) : null}
          <button
            type="button"
            className="size-9 rounded-lg grid place-items-center text-[var(--muted)] hover:bg-white"
            aria-label="Notifications"
          >
            <IconBell className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="size-9 rounded-lg grid place-items-center text-[var(--muted)] hover:bg-white border border-[var(--line)] bg-white"
            aria-label="Settings"
          >
            <IconApps className="size-[18px]" />
          </button>
        </header>
        <main className="px-8 pb-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
