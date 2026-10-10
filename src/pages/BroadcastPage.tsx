import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { BrandMark } from '../components/icons';
import { Button, Card, ConfirmDialog, FieldLabel, Input, PageHeader, Textarea } from '../components/ui';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth';
import { can } from '../lib/roles';

type Audience = 'patients' | 'providers' | 'all';

const AUDIENCES: { id: Audience; title: string; hint: string }[] = [
  { id: 'patients', title: 'Patients', hint: 'Everyone with an active patient account' },
  { id: 'providers', title: 'Providers', hint: 'Doctors, caretakers, clinic, lab and pharmacy logins' },
  { id: 'all', title: 'Everyone', hint: 'Patients and providers' },
];

const TITLE_MAX = 80;
const BODY_MAX = 300;

function PhonePreview({ title, body }: { title: string; body: string }) {
  const now = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return (
    <div
      className="mx-auto w-[280px] rounded-[38px] border-[10px] border-[#1a2a2f] bg-[linear-gradient(170deg,#0e7a81_0%,#1a2a2f_100%)] p-3 pt-2 shadow-xl"
      aria-label="Notification preview"
    >
      <div className="flex justify-between px-3 text-[11px] font-semibold text-white/90">
        <span>{now}</span>
        <span aria-hidden>●●● ▮</span>
      </div>
      <div className="mx-auto mt-1 h-5 w-24 rounded-full bg-black/80" aria-hidden />
      <div className="mt-10 text-center text-[42px] font-light leading-none text-white/95">{now}</div>
      <div className="mt-8 rounded-2xl bg-white/85 p-3 backdrop-blur">
        <div className="flex items-center gap-2 text-[11px] text-[#475467]">
          <BrandMark className="size-5 rounded-[5px]" />
          <span className="font-medium uppercase tracking-wide">NOD Care</span>
          <span className="ml-auto">now</span>
        </div>
        <div className="mt-1.5 text-[13px] font-semibold text-[#101828] break-words">{title || 'Notification title'}</div>
        <div className="mt-0.5 text-[12.5px] leading-snug text-[#344054] break-words line-clamp-4">
          {body || 'Your message appears here.'}
        </div>
      </div>
      <div className="h-36" aria-hidden />
    </div>
  );
}

export function BroadcastPage() {
  const { user } = useAuth();
  const canSend = can(user?.role, 'cms');
  const [audience, setAudience] = useState<Audience>('patients');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<{ recipients: number; audience: Audience } | null>(null);
  // Guards against a second send from a double click before React re-renders the busy state.
  const inFlight = useRef(false);

  const valid = title.trim().length >= 3 && body.trim().length >= 3;
  const audienceInfo = AUDIENCES.find((a) => a.id === audience)!;

  const send = useMutation({
    mutationFn: () =>
      apiRequest<{ recipients: number }>('/admin/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({ audience, title: title.trim(), body: body.trim() }),
      }),
    onSettled: () => {
      inFlight.current = false;
    },
    onSuccess: (r) => {
      setSent({ recipients: r.recipients, audience });
      setConfirming(false);
      setTitle('');
      setBody('');
      setError('');
    },
    onError: (err: Error) => setError(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(null);
    if (valid && !send.isPending) setConfirming(true);
  }

  return (
    <div>
      <PageHeader
        eyebrow="App Configuration"
        title="Broadcast"
        subtitle="Send an in-app notification and push message to a whole audience. Use sparingly — every send reaches phones immediately."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <Card>
          {!canSend ? (
            <p className="mb-4 text-sm text-[var(--muted)]">Broadcasting needs an Ops Admin or Super Admin role.</p>
          ) : null}
          {sent ? (
            <div className="mb-4 rounded-lg bg-[#ecfdf3] px-3 py-2 text-sm text-[#067647]" role="status">
              Sent to {sent.recipients.toLocaleString('en-IN')}{' '}
              {sent.recipients === 1
                ? sent.audience === 'all'
                  ? 'person'
                  : sent.audience.replace(/s$/, '')
                : sent.audience === 'all'
                  ? 'people'
                  : sent.audience}
              {sent.recipients === 0 ? ' — no active accounts matched this audience.' : '.'}
            </div>
          ) : null}
          <form className="space-y-5" onSubmit={onSubmit}>
            <fieldset>
              <legend className="block text-xs font-semibold text-[var(--muted)] mb-2">Audience</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {AUDIENCES.map((a) => (
                  <label
                    key={a.id}
                    className={`cursor-pointer rounded-lg border px-3 py-2.5 text-sm ${
                      audience === a.id
                        ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                        : 'border-[var(--line)] hover:bg-[#f8fafb]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      aria-label={a.title}
                      className="sr-only"
                      checked={audience === a.id}
                      onChange={() => setAudience(a.id)}
                    />
                    <span className="font-medium">{a.title}</span>
                    <span className="block text-xs text-[var(--muted)]">{a.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <FieldLabel htmlFor="broadcast-title" hint={`(${title.length}/${TITLE_MAX})`}>
                Title
              </FieldLabel>
              <Input
                id="broadcast-title"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Clinics closed on Diwali"
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="broadcast-body" hint={`(${body.length}/${BODY_MAX})`}>
                Message
              </FieldLabel>
              <Textarea
                id="broadcast-body"
                value={body}
                maxLength={BODY_MAX}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Keep it short and actionable."
                className="min-h-[120px]"
                required
              />
            </div>
            <p className="text-xs text-[var(--muted)]">Title and message need at least 3 characters. Only active accounts receive it.</p>
            <Button type="submit" disabled={!valid || !canSend || send.isPending}>
              {send.isPending ? 'Sending…' : 'Review and send'}
            </Button>
          </form>
        </Card>
        <div>
          <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--muted)] mb-3 text-center">
            Live preview
          </div>
          <PhonePreview title={title.trim()} body={body.trim()} />
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Send to ${audienceInfo.title.toLowerCase()}?`}
        tone="primary"
        message={
          <>
            “<span className="font-medium text-[var(--ink)]">{title.trim()}</span>” goes to{' '}
            {audienceInfo.hint.toLowerCase()} as an in-app notification and push message. It cannot be recalled once
            sent.
          </>
        }
        confirmLabel="Send now"
        busyLabel="Sending…"
        busy={send.isPending}
        error={error}
        onConfirm={() => {
          if (inFlight.current || send.isPending) return;
          inFlight.current = true;
          send.mutate();
        }}
        onClose={() => {
          setConfirming(false);
          setError('');
        }}
      />
    </div>
  );
}
