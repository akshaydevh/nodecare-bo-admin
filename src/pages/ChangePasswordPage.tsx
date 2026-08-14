import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BrandLockup } from '../components/icons';
import { Button, Card, ErrorText, Input } from '../components/ui';

export function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--surface)] px-4">
      <Card className="w-full max-w-md">
        <BrandLockup />
        <h1 className="text-2xl font-semibold mt-6">Change password</h1>
        <p className="text-sm text-[var(--muted)] mt-2">
          You must set a new password before using the dashboard.
        </p>
        <form className="space-y-3 mt-6" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Current password</span>
            <Input
              className="mt-1"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">New password (min 8 chars)</span>
            <Input
              className="mt-1"
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
