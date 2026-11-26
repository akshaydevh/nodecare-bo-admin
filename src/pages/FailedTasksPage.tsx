import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { IconAlert, IconBadgeCheck, IconClock } from '../components/icons';
import {
  Button,
  ConfirmDialog,
  DetailRow,
  Drawer,
  EmptyState,
  ErrorText,
  KpiCard,
  PageHeader,
  Pagination,
  SectionTitle,
  SkeletonRows,
  StatusPill,
  Table,
  TableMessage,
  Tabs,
} from '../components/ui';
import { apiRequest, apiRequestWithMeta, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDateTime, relativeFromNow, relativeTime } from '../lib/format';
import { can } from '../lib/roles';
import {
  describeTask,
  KIND_LABEL,
  KIND_PILL,
  shortId,
  taskAdvice,
  taskError,
  taskFields,
  taskSubject,
  type FailedTask,
  type FailedTasksMeta,
} from './failed-tasks/task-types';

const LIMIT = 20;
type View = 'dead' | 'pending';

const HEADERS: Record<View, string[]> = {
  dead: ['Task', 'About', 'Reason', 'Tries', 'Stopped', ''],
  pending: ['Task', 'About', 'Reason', 'Tries', 'Next try', ''],
};

const NO_REASON = 'No reason was recorded.';

/** Error text rarely ends with a full stop; this makes it read as one sentence in a notice. */
function sentence(text: string) {
  return `${text.replace(/[.\s]+$/, '')}.`;
}

export function FailedTasksPage() {
  const { user } = useAuth();
  const allowed = can(user?.role, 'finance');
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('dead');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FailedTask | null>(null);
  const [confirming, setConfirming] = useState<FailedTask | null>(null);
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  const list = useQuery({
    queryKey: ['failed-tasks', view, page],
    queryFn: () =>
      apiRequestWithMeta<FailedTask[], FailedTasksMeta>(
        `/admin/event-deliveries${qs({ status: view, page, limit: LIMIT })}`,
      ),
    placeholderData: keepPreviousData,
    enabled: allowed,
    refetchInterval: 60_000,
  });

  const retry = useMutation({
    mutationFn: (task: FailedTask) =>
      apiRequest<FailedTask>(`/admin/event-deliveries/${encodeURIComponent(task.id)}/retry`, { method: 'POST' }),
    onSuccess: (result) => {
      const { label } = describeTask(result);
      if (result.status === 'done') {
        setNotice({ tone: 'good', text: `Done. "${label}" completed.` });
        setSelected(null);
      } else {
        setNotice({
          tone: 'bad',
          text: `"${label}" failed again. ${sentence(taskError(result) ?? NO_REASON)} It will keep retrying by itself.`,
        });
        setSelected((current) => (current?.id === result.id ? result : current));
      }
      setConfirming(null);
      void queryClient.invalidateQueries({ queryKey: ['failed-tasks'] });
    },
  });

  if (!allowed) {
    return (
      <div>
        <PageHeader eyebrow="Finance" title="Failed tasks" />
        <EmptyState
          icon={<IconAlert className="size-5" />}
          title="Not available for your role"
          body="Only Super Admin, Ops Admin and Finance accounts can see and retry failed tasks."
        />
      </div>
    );
  }

  const items = list.data?.data ?? [];
  const meta = list.data?.meta;
  const headers = HEADERS[view];

  function changeView(next: string) {
    setView(next as View);
    setPage(1);
    setNotice(null);
  }

  function askRetry(task: FailedTask) {
    retry.reset();
    setConfirming(task);
  }

  const confirmingTask = confirming ? describeTask(confirming) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Failed tasks"
        subtitle="Refunds, payment updates and notifications that the system could not complete. Each one is retried automatically: refunds and payments for about a day, notifications for about an hour. Anything under Needs attention has stopped retrying and waits for you."
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6 max-w-3xl">
        <KpiCard
          label="Needs attention"
          value={meta ? String(meta.dead) : '...'}
          tone={meta && meta.dead > 0 ? 'alert' : undefined}
          hint={meta && meta.dead > 0 ? 'Stopped retrying' : 'Nothing is stuck'}
          icon={<IconAlert className="size-5" />}
          iconClassName="bg-[#fef3f2] text-[var(--danger)]"
        />
        <KpiCard
          label="Still retrying"
          value={meta ? String(meta.retrying) : '...'}
          hint="Failed at least once, will try again"
          icon={<IconClock className="size-5" />}
          iconClassName="bg-[#fffaeb] text-[#b54708]"
        />
      </div>

      <div className="mb-4">
        <Tabs
          items={[
            { id: 'dead', label: 'Needs attention', count: meta?.dead },
            { id: 'pending', label: 'Still retrying', count: meta?.retrying },
          ]}
          value={view}
          onChange={changeView}
        />
      </div>

      {notice ? (
        <div
          role="status"
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            notice.tone === 'good' ? 'bg-[#ecfdf3] text-[#067647]' : 'bg-[#fef3f2] text-[#b42318]'
          }`}
        >
          {notice.text}
        </div>
      ) : null}
      {list.isError ? <ErrorText>{(list.error as Error).message}</ErrorText> : null}

      <Table headers={headers}>
        {list.isLoading ? (
          <TableMessage colSpan={headers.length}>
            <SkeletonRows rows={5} className="h-10" />
          </TableMessage>
        ) : list.data && items.length === 0 ? (
          <TableMessage colSpan={headers.length}>
            <EmptyState
              icon={<IconBadgeCheck className="size-5" />}
              title={view === 'dead' ? 'Nothing needs attention' : 'Nothing is retrying'}
              body={
                view === 'dead'
                  ? 'Every refund, payment update and notification has gone through or is still being retried.'
                  : 'No task has failed recently.'
              }
            />
          </TableMessage>
        ) : (
          items.map((task) => {
            const { label, kind } = describeTask(task);
            const subject = taskSubject(task);
            const reason = taskError(task);
            return (
              <tr
                key={task.id}
                className={`cursor-pointer ${selected?.id === task.id ? 'bg-[var(--brand-soft)]' : 'hover:bg-[#f8fafb]'}`}
                onClick={() => setSelected(task)}
              >
                <td className="px-4 py-3 min-w-[190px]">
                  <div className="font-medium">{label}</div>
                  <div className="mt-1">
                    <StatusPill status={KIND_PILL[kind]} label={KIND_LABEL[kind]} />
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {subject ? (
                    <>
                      <div>{subject.label}</div>
                      <div
                        className={`text-xs text-[var(--muted)] ${subject.isId ? 'font-mono' : 'max-w-[180px] truncate'}`}
                        title={subject.value}
                      >
                        {subject.isId ? shortId(subject.value) : subject.value}
                      </div>
                    </>
                  ) : (
                    <span className="text-[var(--muted)]">Not recorded</span>
                  )}
                </td>
                <td className="px-4 py-3 min-w-[200px] max-w-[320px]">
                  <div className={`line-clamp-2 break-words ${reason ? '' : 'text-[var(--muted)]'}`} title={reason ?? undefined}>
                    {reason ?? NO_REASON}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{task.attempts}</td>
                <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]">
                  {view === 'pending' && task.nextAttemptAt
                    ? relativeFromNow(task.nextAttemptAt)
                    : relativeTime(task.updatedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="soft"
                    className="whitespace-nowrap"
                    aria-label={`Retry ${label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      askRetry(task);
                    }}
                  >
                    Retry now
                  </Button>
                </td>
              </tr>
            );
          })
        )}
      </Table>
      {meta && meta.total > 0 ? (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPage={setPage} />
      ) : null}

      <TaskDrawer task={selected} onClose={() => setSelected(null)} onRetry={askRetry} />

      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirmingTask?.kind === 'refund' ? 'Retry this refund?' : 'Retry this task?'}
        message={
          confirmingTask?.kind === 'refund'
            ? 'This asks Razorpay to send the refund to the customer now. If it goes through, the customer is also told.'
            : `This runs "${confirmingTask?.label ?? 'the task'}" again now.`
        }
        confirmLabel="Retry now"
        busyLabel="Retrying..."
        tone="primary"
        busy={retry.isPending}
        error={retry.isError ? (retry.error as Error).message : undefined}
        onConfirm={() => confirming && retry.mutate(confirming)}
        onClose={() => setConfirming(null)}
      />
    </div>
  );
}

function TaskDrawer({
  task,
  onClose,
  onRetry,
}: {
  task: FailedTask | null;
  onClose: () => void;
  onRetry: (task: FailedTask) => void;
}) {
  if (!task) return null;
  const { label, kind } = describeTask(task);
  const reason = taskError(task);
  const advice = taskAdvice(task);
  const fields = taskFields(task);
  const stopped = task.status === 'dead';

  return (
    <Drawer
      open
      title={label}
      subtitle={stopped ? 'Stopped retrying. It waits for a manual retry.' : 'Still retrying automatically.'}
      onClose={onClose}
      size="lg"
    >
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <StatusPill status={KIND_PILL[kind]} label={KIND_LABEL[kind]} />
        <StatusPill status={stopped ? 'failed' : 'held'} label={stopped ? 'Needs attention' : 'Retrying'} />
      </div>

      <SectionTitle>Why it failed</SectionTitle>
      <div className="rounded-lg bg-[#f8fafb] border border-[var(--line)] px-3.5 py-3 text-sm break-words whitespace-pre-wrap">
        {reason ?? NO_REASON}
      </div>
      {advice ? <p className="mt-2.5 text-sm text-[var(--muted)] leading-relaxed">{advice}</p> : null}

      <div className="mt-6">
        <SectionTitle>What it concerns</SectionTitle>
        <div className="divide-y divide-[var(--line)]">
          {fields.length === 0 ? (
            <p className="py-2 text-sm text-[var(--muted)]">No details were recorded.</p>
          ) : (
            fields.map((field) => (
              <DetailRow key={field.label} label={field.label}>
                <span className={field.isId ? 'font-mono text-[13px] select-all' : ''}>{field.value}</span>
              </DetailRow>
            ))
          )}
        </div>
      </div>

      <div className="mt-6">
        <SectionTitle>History</SectionTitle>
        <div className="divide-y divide-[var(--line)]">
          <DetailRow label="First happened">{formatDateTime(task.occurredAt)}</DetailRow>
          <DetailRow label="Last tried">{formatDateTime(task.updatedAt)}</DetailRow>
          <DetailRow label="Tries so far">{task.attempts}</DetailRow>
          <DetailRow label="Next automatic try">
            {task.nextAttemptAt ? formatDateTime(task.nextAttemptAt) : 'None, it has stopped'}
          </DetailRow>
          <DetailRow label="Technical name">
            <span className="font-mono text-[13px]">
              {task.event} / {task.handler}
            </span>
          </DetailRow>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => onRetry(task)}>Retry now</Button>
      </div>
    </Drawer>
  );
}
