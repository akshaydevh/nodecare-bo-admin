import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog } from '../../components/ui';
import { ApiError, apiRequest } from '../../lib/api';

export type StatusTarget = { id: string; name: string; accountStatus: string };

/** Suspend or reactivate an app account via PATCH /admin/users/:id/status. */
export function AccountStatusDialog({ account, onClose }: { account: StatusTarget | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const suspending = account?.accountStatus === 'active';

  const update = useMutation({
    mutationFn: () =>
      apiRequest(`/admin/users/${account!.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ accountStatus: suspending ? 'suspended' : 'active' }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ops-patients'] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      setError('');
      onClose();
    },
    onError: (err: Error) => {
      // The API refuses self-changes and back-office accounts; say where to go instead.
      if (err instanceof ApiError && err.code === 'SELF_STATUS_CHANGE') {
        setError('You cannot change the status of your own account.');
      } else if (err instanceof ApiError && err.code === 'TEAM_ACCOUNT') {
        setError('This is a back-office account. Manage it from Team & Roles.');
      } else {
        setError(err.message);
      }
    },
  });

  return (
    <ConfirmDialog
      open={Boolean(account)}
      title={suspending ? `Suspend ${account?.name}?` : `Reactivate ${account?.name}?`}
      message={
        suspending ? (
          <>
            They are signed out of every device immediately and cannot sign in or book until reactivated. Existing
            bookings are not cancelled — cancel them from Bookings if needed.
          </>
        ) : (
          <>They can sign in again with their phone number and use the app as before.</>
        )
      }
      tone={suspending ? 'danger' : 'primary'}
      confirmLabel={suspending ? 'Suspend account' : 'Reactivate account'}
      busyLabel={suspending ? 'Suspending…' : 'Reactivating…'}
      busy={update.isPending}
      error={error}
      onConfirm={() => update.mutate()}
      onClose={() => {
        setError('');
        onClose();
      }}
    />
  );
}
