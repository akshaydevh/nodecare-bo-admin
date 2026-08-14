import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow ? (
          <div className="text-[11px] font-semibold tracking-[0.18em] text-[var(--brand)] uppercase">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[32px] font-semibold tracking-tight mt-1.5 text-[var(--ink)]">{title}</h1>
        {subtitle ? <p className="text-sm text-[var(--muted)] mt-1.5 max-w-2xl">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-[var(--line)] rounded-xl p-5 shadow-[var(--shadow)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft' }) {
  const styles =
    variant === 'primary'
      ? 'bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]'
      : variant === 'danger'
        ? 'bg-[#fef3f2] text-[var(--danger)] hover:bg-[#fee4e2]'
        : variant === 'soft'
          ? 'bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[#d7ece8]'
          : 'bg-white border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--brand-soft)] shadow-[var(--shadow)]';
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return (
    <input
      className={`w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] ${className}`}
      {...rest}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return (
    <textarea
      className={`w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] min-h-[88px] ${className}`}
      {...rest}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', ...rest } = props;
  return (
    <select
      className={`w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] ${className}`}
      {...rest}
    />
  );
}

export function Table({
  headers,
  children,
  embedded = false,
}: {
  headers: string[];
  children: ReactNode;
  embedded?: boolean;
}) {
  return (
    <div
      className={
        embedded
          ? 'overflow-x-auto'
          : 'overflow-x-auto border border-[var(--line)] rounded-xl bg-white shadow-[var(--shadow)]'
      }
    >
      <table className="min-w-full text-sm">
        <thead className="bg-[#f8fafb] text-left">
          <tr>
            {headers.map((h, i) => (
              <th key={`${h}-${i}`} className="px-4 py-3 font-semibold text-[11px] tracking-[0.1em] uppercase text-[var(--muted)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">{children}</tbody>
      </table>
    </div>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-[var(--danger)] mt-2">{children}</p>;
}

export function Avatar({
  initials,
  src,
  className = '',
}: {
  initials: string;
  src?: string | null;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`size-8 rounded-full object-cover bg-[var(--brand-soft)] ${className}`}
      />
    );
  }
  return (
    <span
      className={`inline-flex size-8 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[11px] font-semibold text-[var(--brand)] ${className}`}
    >
      {initials}
    </span>
  );
}

export function StatusPill({
  status,
}: {
  status: string;
}) {
  const key = status.toLowerCase().replace(/_/g, ' ');
  const map: Record<string, string> = {
    pending: 'bg-[#fffaeb] text-[#b54708]',
    invited: 'bg-[#f2f4f7] text-[#475467]',
    verified: 'bg-[#ecfdf3] text-[#067647]',
    active: 'bg-[#ecfdf3] text-[#067647]',
    completed: 'bg-[#ecfdf3] text-[#067647]',
    confirmed: 'bg-[#eff8ff] text-[#175cd3]',
    scheduled: 'bg-[#eff8ff] text-[#175cd3]',
    'in progress': 'bg-[#fffaeb] text-[#b54708]',
    'en route': 'bg-[#fffaeb] text-[#b54708]',
    packing: 'bg-[#fffaeb] text-[#b54708]',
    dispatched: 'bg-[#fffaeb] text-[#b54708]',
    suspended: 'bg-[#fef3f2] text-[#b42318]',
    cancelled: 'bg-[#f2f4f7] text-[#475467]',
    offline: 'bg-[#f2f4f7] text-[#475467]',
    available: 'bg-[#ecfdf3] text-[#067647]',
    'on trip': 'bg-[#fef3f2] text-[#b42318]',
    'needs review': 'bg-[#fef3f2] text-[#b42318]',
  };
  const dot =
    key === 'verified' || key === 'active' || key === 'available' || key === 'completed'
      ? 'bg-[#12b76a]'
      : key === 'pending' || key === 'on trip' || key === 'en route'
        ? 'bg-[#f79009]'
        : key === 'suspended' || key === 'cancelled'
          ? 'bg-[#f04438]'
          : 'bg-[#98a2b3]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[key] ?? 'bg-[#f2f4f7] text-[#475467]'}`}
    >
      <span className={`size-1.5 rounded-full ${dot}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function StatusDot({ status, label }: { status: string; label?: string }) {
  const key = status.toLowerCase().replace(/_/g, ' ');
  const color =
    key === 'verified' || key === 'active' || key === 'available' || key === 'completed'
      ? 'bg-[#12b76a]'
      : key === 'pending' || key === 'on trip' || key === 'en route'
        ? 'bg-[#f79009]'
        : key === 'suspended' || key === 'cancelled'
          ? 'bg-[#f04438]'
          : 'bg-[#98a2b3]';
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={`size-1.5 rounded-full ${color}`} />
      {label ?? status.replace(/_/g, ' ')}
    </span>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const pages =
    totalPages <= 5
      ? Array.from({ length: totalPages }, (_, i) => i + 1)
      : Array.from({ length: 3 }, (_, i) => Math.min(Math.max(page - 1, 1), totalPages - 2) + i);
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-[var(--muted)]">
      <span>
        Showing {from}-{to} of {total.toLocaleString('en-IN')}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} className="size-8 p-0">
          ‹
        </Button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            className={`size-8 rounded-full text-sm font-medium ${
              p === page
                ? 'bg-[var(--brand)] text-white'
                : 'text-[var(--ink)] hover:bg-[var(--brand-soft)]'
            }`}
          >
            {p}
          </button>
        ))}
        <Button variant="ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="size-8 p-0">
          ›
        </Button>
      </div>
    </div>
  );
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-full px-3.5 py-1.5 text-sm ${
            value === item.id
              ? 'bg-[var(--sidebar)] text-white'
              : 'bg-white border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--brand-soft)]'
          }`}
        >
          {item.label}
          {item.count !== undefined ? ` · ${item.count}` : ''}
        </button>
      ))}
    </div>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" className="flex-1 bg-black/20" aria-label="Close" onClick={onClose} />
      <aside className="w-full max-w-md bg-white h-full shadow-xl overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3 mb-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-[var(--muted)] text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  size = 'md',
  zClass = 'z-50',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg';
  zClass?: string;
}) {
  if (!open) return null;
  return (
    <div className={`fixed inset-0 ${zClass} grid place-items-center bg-black/30 p-4`}>
      <div
        className={`w-full ${size === 'lg' ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] bg-white rounded-xl shadow-xl flex flex-col overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 shrink-0 bg-white border-b border-[var(--line)]">
          <h2 className="text-lg font-semibold pr-4">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 size-8 -mr-1 -mt-1 grid place-items-center rounded-lg text-[var(--muted)] text-xl leading-none hover:bg-[var(--surface)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto min-h-0">{children}</div>
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone,
  icon,
  iconClassName = 'bg-[var(--brand-soft)] text-[var(--brand)]',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'up' | 'down' | 'alert';
  icon?: ReactNode;
  iconClassName?: string;
}) {
  const hintColor =
    tone === 'down' || tone === 'alert' ? 'text-[var(--danger)]' : tone === 'up' ? 'text-[var(--success)]' : 'text-[var(--muted)]';
  return (
    <Card>
      {icon ? (
        <span className={`mb-4 inline-flex size-10 items-center justify-center rounded-lg ${iconClassName}`}>
          {icon}
        </span>
      ) : null}
      <div className="text-[13px] text-[var(--muted)]">{label}</div>
      <div className="text-[28px] font-semibold tracking-tight mt-1">{value}</div>
      {hint ? <div className={`text-[13px] mt-2 font-medium ${hintColor}`}>{hint}</div> : null}
    </Card>
  );
}

export function ServiceChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-md bg-[var(--brand-soft)] text-[var(--brand)] px-2 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}
