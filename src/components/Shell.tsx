import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  BrandLockup,
  IconApps,
  IconBarChart,
  IconBell,
  IconBuilding,
  IconCalendar,
  IconLab,
  IconLayout,
  IconLogout,
  IconSearch,
  IconSettings,
  IconShield,
  IconStethoscope,
  IconUser,
  IconUsers,
} from './icons';

type Summary = {
  doctors: number;
  medicalCentres: number;
  centres: number;
  serviceProviders: number;
  bookings: number;
  ambulancesActive: number;
};

const nav: {
  label: string;
  items: { to: string; label: string; end?: boolean; countKey?: keyof Summary; icon: ReactNode }[];
}[] = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', end: true, icon: <IconLayout className="size-4" /> }],
  },
  {
    label: 'Network',
    items: [
      { to: '/doctors', label: 'Doctors', countKey: 'doctors', icon: <IconStethoscope className="size-4" /> },
      { to: '/medical-centres', label: 'Medical Centres', countKey: 'medicalCentres', icon: <IconBuilding className="size-4" /> },
      { to: '/centres', label: 'Diagnostic Centres', countKey: 'centres', icon: <IconLab className="size-4" /> },
      {
        to: '/providers',
        label: 'Service Providers',
        countKey: 'serviceProviders',
        icon: <IconUsers className="size-4" />,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/bookings', label: 'Bookings', countKey: 'bookings', icon: <IconCalendar className="size-4" /> },
      { to: '/patients', label: 'Patients', icon: <IconUser className="size-4" /> },
      { to: '/reports', label: 'Reports & Sales', icon: <IconBarChart className="size-4" /> },
    ],
  },
  {
    label: 'App Configuration',
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
    items: [
      { to: '/onboarding', label: 'Provider Access', icon: <IconShield className="size-4" /> },
      { to: '/team', label: 'Team & Roles', icon: <IconShield className="size-4" /> },
      { to: '/settings', label: 'Settings', icon: <IconSettings className="size-4" /> },
    ],
  },
];

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

export function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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
            <div key={group.label}>
              <div className="px-3 mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--sidebar-muted)]">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
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
                    {item.countKey && counts ? (
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums text-white/70">
                        {counts[item.countKey]}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            </div>
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
