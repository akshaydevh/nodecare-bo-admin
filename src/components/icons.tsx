import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, className = 'size-4', ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function BrandMark({ className = 'size-9' }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="NOD Care"
      className={`rounded-[10px] bg-white object-contain ${className}`}
    />
  );
}

export function BrandLockup({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div>
        <div
          className={`text-[15px] font-semibold leading-none tracking-tight ${inverted ? 'text-white' : 'text-[var(--ink)]'}`}
        >
          NOD Care
        </div>
        <div
          className={`text-[10px] uppercase tracking-[0.18em] mt-1.5 ${inverted ? 'text-[#8fa3a8]' : 'text-[var(--muted)]'}`}
        >
          OPS CONSOLE
        </div>
      </div>
    </div>
  );
}

export function IconLayout({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3" y="3" width="7" height="9" rx="1.2" />
      <rect x="14" y="3" width="7" height="5" rx="1.2" />
      <rect x="14" y="12" width="7" height="9" rx="1.2" />
      <rect x="3" y="16" width="7" height="5" rx="1.2" />
    </Icon>
  );
}

export function IconStethoscope({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6 3v7a6 6 0 0 0 12 0V3" />
      <path d="M6 3a2 2 0 0 0-2 2" />
      <path d="M18 3a2 2 0 0 1 2 2" />
      <circle cx="18" cy="19" r="2" />
      <path d="M12 16v1a4 4 0 0 0 4 2" />
    </Icon>
  );
}

export function IconLab({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M9 3h6" />
      <path d="M10 3v6.2L5.4 18.1A2 2 0 0 0 7.1 21h9.8a2 2 0 0 0 1.7-2.9L14 9.2V3" />
      <path d="M8.5 14h7" />
    </Icon>
  );
}

export function IconBuilding({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 21v-4h6v4" />
      <path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01" />
    </Icon>
  );
}

export function IconUsers({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 4.13a3 3 0 0 1 0 5.75" />
    </Icon>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M3 9.5h18M8 3v3M16 3v3" />
    </Icon>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </Icon>
  );
}

export function IconBarChart({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 19V9M12 19V5M20 19v-7" />
    </Icon>
  );
}

export function IconShield({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 3 5 6.5v5.2c0 4.1 2.8 7.9 7 8.8 4.2-.9 7-4.7 7-8.8V6.5L12 3z" />
    </Icon>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M3 12h2M19 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </Icon>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  );
}

export function IconBell({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Icon>
  );
}

export function IconApps({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <rect x="14" y="14" width="7" height="7" rx="1.2" />
    </Icon>
  );
}

export function IconCurrency({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M15.2 9.2c-.7-1-2.8-1.2-3.7-.2s.2 2.2 2.5 2.6 3.2 1.4 2.5 2.7-2.9.9-3.8-.2" />
    </Icon>
  );
}

export function IconPlug({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 22v-5" />
      <path d="M9 8V3M15 8V3" />
      <path d="M7 8h10v4a5 5 0 0 1-10 0V8z" />
    </Icon>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

export function IconLogout({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </Icon>
  );
}
