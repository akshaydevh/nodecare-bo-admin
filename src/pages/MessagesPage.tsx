import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button, Card, ErrorText, Input, PageHeader, Pagination, StatusPill, Tabs, Textarea } from '../components/ui';
import { apiRequest, qs } from '../lib/api';
import { relativeTime } from '../lib/format';

type Inquiry = {
  id: string;
  name: string;
  email: string;
  role: string;
  preview: string;
  status: 'new' | 'replied';
  replyCount: number;
  createdAt: string;
};

type InquiryDetail = {
  id: string;
  name: string;
  email: string;
  role: string;
  message: string;
  status: 'new' | 'replied';
  createdAt: string;
  replies: { subject: string; body: string; sentAt: string; sentByName: string }[];
};

type Page = { items: Inquiry[]; total: number; page: number; totalPages: number; limit: number };

export function MessagesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['website-messages', q, status, page],
    queryFn: () =>
      apiRequest<Page>(`/admin/website/messages${qs({ q, status: status || undefined, page, limit: 12 })}`),
  });

  const detail = useQuery({
    queryKey: ['website-message', selectedId],
    queryFn: () => apiRequest<InquiryDetail>(`/admin/website/messages/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const reply = useMutation({
    mutationFn: () =>
      apiRequest<InquiryDetail>(`/admin/website/messages/${selectedId}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          body,
          ...(subject.trim() ? { subject: subject.trim() } : {}),
        }),
      }),
    onSuccess: async () => {
      setError('');
      setBody('');
      setSubject('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['website-messages'] }),
        qc.invalidateQueries({ queryKey: ['website-message', selectedId] }),
        qc.invalidateQueries({ queryKey: ['ops-summary'] }),
      ]);
    },
    onError: (err: Error) => setError(err.message),
  });

  function onReply(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !body.trim()) return;
    reply.mutate();
  }

  const data = list.data;
  const message = detail.data;

  return (
    <div>
      <PageHeader
        title="Website messages"
        subtitle="Notes sent from the NOD website. Open one to reply by email."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name, email, or message"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="max-w-xs"
        />
        <Tabs
          items={[
            { id: '', label: 'All' },
            { id: 'new', label: 'New' },
            { id: 'replied', label: 'Replied' },
          ]}
          value={status}
          onChange={(id) => {
            setPage(1);
            setStatus(id);
          }}
        />
      </div>

      {list.isError ? <ErrorText>{(list.error as Error).message}</ErrorText> : null}

      {list.isLoading ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-14 animate-pulse rounded-xl bg-[#eef1f4]" />
          <div className="h-14 animate-pulse rounded-xl bg-[#eef1f4]" />
          <div className="h-14 animate-pulse rounded-xl bg-[#eef1f4]" />
        </div>
      ) : data && data.items.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            No messages yet. New notes from the website contact form will show up here.
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#f8fafb] text-left">
              <tr>
                {['From', 'Role', 'Message', 'Status', 'Received'].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-[11px] font-semibold tracking-[0.1em] text-[var(--muted)] uppercase"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((item) => (
                <tr
                  key={item.id}
                  className={`cursor-pointer border-t border-[var(--line)] ${
                    selectedId === item.id ? 'bg-[var(--brand-soft)]' : 'hover:bg-[#f8fafb]'
                  }`}
                  onClick={() => {
                    setSelectedId(item.id);
                    setError('');
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-[var(--muted)]">{item.email}</div>
                  </td>
                  <td className="px-4 py-3">{item.role}</td>
                  <td className="max-w-[280px] truncate px-4 py-3 text-[var(--muted)]">{item.preview}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={item.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]">{relativeTime(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data ? (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={data.limit}
              onPage={setPage}
            />
          ) : null}
        </div>
      )}

      {selectedId ? (
        <Card className="mt-4">
          {detail.isLoading ? <p className="text-sm text-[var(--muted)]">Loading message</p> : null}
          {detail.isError ? <ErrorText>{(detail.error as Error).message}</ErrorText> : null}
          {message ? (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{message.name}</h2>
                  <StatusPill status={message.status} />
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {message.email} · {message.role}
                </p>
                <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap">{message.message}</p>
                {message.replies.length > 0 ? (
                  <div className="mt-6 space-y-3">
                    <h3 className="text-sm font-semibold">Sent replies</h3>
                    {message.replies.map((item) => (
                      <div key={item.sentAt} className="rounded-lg bg-[#f8fafb] px-3 py-3 text-sm">
                        <div className="text-xs text-[var(--muted)]">
                          {item.sentByName} · {relativeTime(item.sentAt)}
                        </div>
                        <div className="mt-1 font-medium">{item.subject}</div>
                        <p className="mt-1 whitespace-pre-wrap text-[var(--muted)]">{item.body}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <form onSubmit={onReply} className="space-y-3">
                <h3 className="text-sm font-semibold">Reply by email</h3>
                <label className="block text-xs font-semibold text-[var(--muted)]" htmlFor="reply-subject">
                  Subject
                </label>
                <Input
                  id="reply-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="NOD Healthcare: a reply to your message"
                />
                <label className="block text-xs font-semibold text-[var(--muted)]" htmlFor="reply-body">
                  Message
                </label>
                <Textarea
                  id="reply-body"
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[140px]"
                />
                <p className="text-xs text-[var(--muted)]">This is emailed to {message.email}.</p>
                {error ? <ErrorText>{error}</ErrorText> : null}
                <Button type="submit" disabled={reply.isPending || body.trim().length === 0}>
                  {reply.isPending ? 'Sending' : 'Send reply'}
                </Button>
              </form>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
