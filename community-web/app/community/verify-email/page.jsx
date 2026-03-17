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

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, [searchParams]);

  const requestVerification = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      const response = await api.requestEmailVerification(email.trim());
      if (response?.email_verification_token) {
        setToken(response.email_verification_token);
      }
      setStatus('If an account exists, a verification email has been sent.');
    } catch (requestError) {
      setError(toUserErrorMessage(requestError, 'Failed to request email verification.'));
    }
  };

  const confirmVerification = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      await api.confirmEmailVerification(token.trim());
      setStatus('Email verification complete.');
    } catch (confirmError) {
      setError(toUserErrorMessage(confirmError, 'Failed to verify email token.'));
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card">
        <h1 className="text-2xl font-bold">Verify Email</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Request a verification link to confirm ownership of your email address.
        </p>
        <form onSubmit={requestVerification} className="mt-4 space-y-2">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Email"
            required
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">Send verification</button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Confirm Token</h2>
        <p className="mt-2 text-sm text-zinc-300">Paste the verification token from your email.</p>
        <form onSubmit={confirmVerification} className="mt-4 space-y-2">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Verification token"
            required
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">Verify token</button>
        </form>
        <ErrorText message={error} />
        {status && <p className="mt-2 text-sm text-emerald-300">{status}</p>}
      </section>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<section className="card"><p className="text-sm text-zinc-400">Loading verification tools...</p></section>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
