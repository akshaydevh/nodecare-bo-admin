import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { IconUserX } from '../components/icons';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorText,
  FieldLabel,
  PageHeader,
  Pagination,
  SkeletonRows,
  StatusPill,
  Table,
  TableMessage,
  Tabs,
  Textarea,
} from '../components/ui';
import { apiRequest, apiRequestWithMeta, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDateTime, relativeTime } from '../lib/format';
import { can } from '../lib/roles';

type DeletionRequest = {
  id: string;
  phone: string;
  name: string | null;
  reason: string | null;
  source: 'app' | 'website';
  hasAccount: boolean;
  status: 'pending' | 'completed' | 'rejected';
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

type Resolve = { request: DeletionRequest; action: 'complete' | 'reject' };

const HEADERS = ['Requested by', 'Source', 'Reason', 'Received', 'Status', ''];

export function DeletionRequestsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canWrite = can(user?.role, 'userStatus');
  const [status, setStatus] = useState<'pending' | 'completed' | 'rejected' | ''>('pending');
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<Resolve | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['deletion-requests', status, page],
    queryFn: () => apiRequestWithMeta<DeletionRequest[]>(`/admin/account-deletion-requests${qs({ status, page, limit: 20 })}`),
    placeholderData: keepPreviousData,
  });

  const resolve = useMutation({
    mutationFn: ({ request, action }: Resolve) =>
      apiRequest(`/admin/account-deletion-requests/${request.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ action, ...(note.trim() ? { note: note.trim() } : {}) }),
      }),
    onSuccess: () => {
      setResolving(null);
      setNote('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['deletion-requests'] });
      void qc.invalidateQueries({ queryKey: ['ops-summary'] });
      void qc.invalidateQueries({ queryKey: ['ops-patients'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const items = list.data?.data ?? [];
  const meta = list.data?.meta;
  const completing = resolving?.action === 'complete';
  const who = resolving ? resolving.request.name || resolving.request.phone : '';

  return (
    <div>
      <PageHeader
        eyebrow="Users"
        title="Account deletion requests"
        subtitle="Requests from the website form and from provider accounts in the app. Patients who delete in the app are erased immediately and do not appear here."
      />
      <div className="mb-4">
        <Tabs
          value={status || 'all'}
          onChange={(id) => {
            setStatus(id === 'all' ? '' : (id as typeof status));
            setPage(1);
          }}
          items={[
            { id: 'pending', label: 'Pending' },
            { id: 'completed', label: 'Completed' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'all', label: 'All' },
          ]}
        />
      </div>
      {list.isError ? <ErrorText>{(list.error as Error).message}</ErrorText> : null}
      <Table headers={HEADERS}>
        {list.isLoading ? (
          <TableMessage colSpan={HEADERS.length}>
            <SkeletonRows rows={4} className="h-10" />
          </TableMessage>
        ) : items.length === 0 ? (
          <TableMessage colSpan={HEADERS.length}>
            <EmptyState
              icon={<IconUserX className="size-5" />}
              title={status === 'pending' ? 'No pending requests' : 'Nothing here yet'}
              body={status === 'pending' ? 'New deletion requests will show up here.' : undefined}
            />
          </TableMessage>
        ) : (
          items.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3">
                <div className="font-medium">{r.name || 'No name given'}</div>
                <div className="text-xs text-[var(--muted)]">
                  {r.phone}
                  {r.hasAccount ? '' : ' · no matching account'}
                </div>
              </td>
              <td className="px-4 py-3 capitalize">{r.source}</td>
              <td className="px-4 py-3 max-w-[280px]">
                <span className="line-clamp-2 text-[var(--muted)]">{r.reason || '—'}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap" title={formatDateTime(r.createdAt)}>
                {relativeTime(r.createdAt)}
              </td>
              <td className="px-4 py-3">
                <StatusPill status={r.status} />
                {r.resolutionNote ? (
                  <div className="mt-1 text-xs text-[var(--muted)] max-w-[200px]">{r.resolutionNote}</div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {r.status === 'pending' && canWrite ? (
                  <div className="flex justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      className="px-2.5 py-1.5"
                      onClick={() => {
                        setNote('');
                        setError('');
                        setResolving({ request: r, action: 'reject' });
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="danger"
                      className="px-2.5 py-1.5"
                      onClick={() => {
                        setNote('');
                        setError('');
                        setResolving({ request: r, action: 'complete' });
                      }}
                    >
                      Delete account
                    </Button>
                  </div>
                ) : r.resolvedAt ? (
                  <span className="text-xs text-[var(--muted)]">{formatDateTime(r.resolvedAt)}</span>
                ) : null}
              </td>
            </tr>
          ))
        )}
      </Table>
      {meta && meta.total > 0 ? (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPage={setPage} />
      ) : null}

      <ConfirmDialog
        open={Boolean(resolving)}
        title={completing ? `Permanently delete ${who}'s account?` : `Reject request from ${who}?`}
        message={
          completing ? (
            resolving?.request.hasAccount ? (
              <>
                Upcoming visits are cancelled (prepaid ones refunded in full), addresses, medical records and
                notifications are deleted, and the profile is anonymised. Past bookings and payments stay for
                accounting without identifying the person. This cannot be undone.
              </>
            ) : (
              <>No account matches this phone number, so the request is simply marked completed.</>
            )
          ) : (
            <>The account is kept as is. Add a note explaining why — for example an outstanding dispute.</>
          )
        }
        tone={completing ? 'danger' : 'primary'}
        confirmLabel={completing ? 'Delete account' : 'Reject request'}
        busyLabel={completing ? 'Deleting…' : 'Rejecting…'}
        busy={resolve.isPending}
        error={error}
        onConfirm={() => resolving && resolve.mutate(resolving)}
        onClose={() => {
          setResolving(null);
          setError('');
        }}
      >
        <div>
          <FieldLabel htmlFor="resolution-note" hint="(optional, internal)">
            Note
          </FieldLabel>
          <Textarea
            id="resolution-note"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[64px]"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
