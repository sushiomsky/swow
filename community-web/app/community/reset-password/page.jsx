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
      setStatus('Falls ein Konto existiert, wurde eine E-Mail zum Zurücksetzen gesendet.');
    } catch (requestError) {
      setError(toUserErrorMessage(requestError, 'Zurücksetzen konnte nicht angefordert werden.'));
    }
  };

  const confirmReset = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    try {
      await api.confirmPasswordReset({ token: token.trim(), password });
      setStatus('Passwort zurückgesetzt. Du kannst dich jetzt mit dem neuen Passwort anmelden.');
      setPassword('');
      setConfirmPassword('');
    } catch (confirmError) {
      setError(toUserErrorMessage(confirmError, 'Passwort konnte nicht zurückgesetzt werden.'));
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card">
        <h1 className="text-2xl font-bold">Passwort zurücksetzen</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Fordere ein Token für deine Konto-E-Mail an.
        </p>
        <form onSubmit={requestReset} className="mt-4 space-y-2">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="E-Mail"
            aria-label="E-Mail"
            required
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">Token senden</button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Zurücksetzen bestätigen</h2>
        <p className="mt-2 text-sm text-zinc-300">Token und neues Passwort eingeben.</p>
        <form onSubmit={confirmReset} className="mt-4 space-y-2">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Reset-Token"
            aria-label="Reset-Token"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Neues Passwort"
            aria-label="Neues Passwort"
            minLength={8}
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Passwort bestätigen"
            aria-label="Passwort bestätigen"
            minLength={8}
            required
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">Passwort zurücksetzen</button>
        </form>
        <ErrorText message={error} />
        {status && <p className="mt-2 text-sm text-emerald-300">{status}</p>}
      </section>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<section className="card"><p className="text-sm text-zinc-400">Zurücksetzen wird geladen…</p></section>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
