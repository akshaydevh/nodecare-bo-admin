import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/users', label: 'Users' },
  { to: '/onboarding', label: 'Onboarding' },
  { to: '/catalog', label: 'Catalog' },
  { to: '/cms', label: 'CMS' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/settings', label: 'Settings' },
];

export function Shell() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="bg-[var(--brand)] text-white flex flex-col">
        <div className="px-5 py-6 border-b border-white/15">
          <div className="text-xs uppercase tracking-[0.18em] opacity-70">NOD Care</div>
          <div className="text-xl font-semibold mt-1">Back Office</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm transition ${
                  isActive ? 'bg-white/15 font-medium' : 'hover:bg-white/10 opacity-90'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/15 text-sm">
          <div className="opacity-80 truncate">{user?.name || user?.username || 'Admin'}</div>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-2 text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex flex-col min-w-0">
        <header className="h-14 border-b border-[var(--line)] bg-white px-6 flex items-center justify-between">
          <div className="text-sm text-[var(--muted)]">Platform operations</div>
          <div className="text-sm font-medium">{user?.email || user?.username}</div>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
