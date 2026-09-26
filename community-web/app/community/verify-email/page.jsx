'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ErrorText from '../../../components/ErrorText';
import { useCommunitySession } from '../../../providers/CommunitySessionProvider';
import { toUserErrorMessage } from '../../../lib/errorUtils';

function VerifyEmailContent() {
  const { api, user } = useCommunitySession();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [autoVerifying, setAutoVerifying] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, [searchParams]);

  // L3: a ?token= in the URL is verified immediately with direct feedback,
  // instead of just pre-filling the form silently.
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (!tokenFromUrl || autoTried) return;
    setAutoTried(true);
    if (tokenFromUrl.trim().length < 32) {
      setError('Dieser Bestätigungslink sieht ungültig aus (Token zu kurz). Fordere unten einen neuen an.');
      return;
    }
    setAutoVerifying(true);
    setError('');
    setStatus('');
    api.confirmEmailVerification(tokenFromUrl.trim())
      .then(() => setStatus('E-Mail bestätigt. Du kannst dich jetzt anmelden.'))
      .catch((confirmError) => setError(toUserErrorMessage(confirmError, 'Dieser Link ist ungültig oder abgelaufen. Fordere unten einen neuen an.')))
      .finally(() => setAutoVerifying(false));
  }, [searchParams, api, autoTried]);

  const requestVerification = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      const response = await api.requestEmailVerification(email.trim());
      if (response?.email_verification_token) {
        setToken(response.email_verification_token);
      }
      setStatus('Falls ein Konto existiert, wurde eine Bestätigungs-E-Mail gesendet.');
    } catch (requestError) {
      setError(toUserErrorMessage(requestError, 'Bestätigungs-E-Mail konnte nicht angefordert werden.'));
    }
  };

  const confirmVerification = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      await api.confirmEmailVerification(token.trim());
      setStatus('E-Mail bestätigt.');
    } catch (confirmError) {
      setError(toUserErrorMessage(confirmError, 'Token konnte nicht bestätigt werden.'));
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card">
        <h1 className="text-2xl font-bold">E-Mail bestätigen</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Fordere einen Bestätigungslink an, um deine E-Mail-Adresse nachzuweisen.
        </p>
        <form onSubmit={requestVerification} className="mt-4 space-y-2">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="E-Mail"
            aria-label="E-Mail"
            required
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">Bestätigung senden</button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Token bestätigen</h2>
        <p className="mt-2 text-sm text-zinc-300">Füge das Token aus deiner E-Mail ein.</p>
        {autoVerifying && <p className="mt-2 text-sm text-zinc-400">Link wird geprüft…</p>}
        <form onSubmit={confirmVerification} className="mt-4 space-y-2">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Bestätigungs-Token"
            aria-label="Bestätigungs-Token"
            required
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">Token bestätigen</button>
        </form>
        <ErrorText message={error} />
        {status && <p className="mt-2 text-sm text-emerald-300">{status}</p>}
      </section>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<section className="card"><p className="text-sm text-zinc-400">Bestätigung wird geladen…</p></section>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
