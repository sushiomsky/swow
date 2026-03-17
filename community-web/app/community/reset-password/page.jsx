'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ErrorText from '../../../components/ErrorText';
import { useCommunitySession } from '../../../providers/CommunitySessionProvider';
import { toUserErrorMessage } from '../../../lib/errorUtils';

function ResetPasswordContent() {
  const { api, user } = useCommunitySession();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, [searchParams]);

  const requestReset = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      const response = await api.requestPasswordReset(email.trim());
      if (response?.password_reset_token) {
        setToken(response.password_reset_token);
      }
      setStatus('If an account exists, a password reset email has been sent.');
    } catch (requestError) {
      setError(toUserErrorMessage(requestError, 'Failed to request password reset.'));
    }
  };

  const confirmReset = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await api.confirmPasswordReset({ token: token.trim(), password });
      setStatus('Password reset complete. You can now log in with your new password.');
      setPassword('');
      setConfirmPassword('');
    } catch (confirmError) {
      setError(toUserErrorMessage(confirmError, 'Failed to reset password.'));
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card">
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Request a reset token for your account email.
        </p>
        <form onSubmit={requestReset} className="mt-4 space-y-2">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Email"
            required
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">Send reset token</button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Confirm Reset</h2>
        <p className="mt-2 text-sm text-zinc-300">Enter reset token and your new password.</p>
        <form onSubmit={confirmReset} className="mt-4 space-y-2">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Reset token"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="New password"
            minLength={8}
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Confirm password"
            minLength={8}
            required
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">Reset password</button>
        </form>
        <ErrorText message={error} />
        {status && <p className="mt-2 text-sm text-emerald-300">{status}</p>}
      </section>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<section className="card"><p className="text-sm text-zinc-400">Loading reset tools...</p></section>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
