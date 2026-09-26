'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ErrorText from '../../../components/ErrorText';
import { useCommunitySession } from '../../../providers/CommunitySessionProvider';
import { useLocale } from '../../../providers/LocaleProvider';
import { toUserErrorMessage } from '../../../lib/errorUtils';

const T = {
  de: {
    title: 'E-Mail bestätigen',
    intro: 'Fordere einen Bestätigungslink an, um deine E-Mail-Adresse nachzuweisen.',
    emailLabel: 'E-Mail',
    send: 'Bestätigung senden',
    confirmTitle: 'Token bestätigen',
    confirmIntro: 'Füge das Token aus deiner E-Mail ein.',
    checking: 'Link wird geprüft…',
    tokenLabel: 'Bestätigungs-Token',
    confirm: 'Token bestätigen',
    loadingFallback: 'Bestätigung wird geladen…',
    badLink: 'Dieser Bestätigungslink sieht ungültig aus (Token zu kurz). Fordere unten einen neuen an.',
    confirmed: 'E-Mail bestätigt. Du kannst dich jetzt anmelden.',
    linkInvalid: 'Dieser Link ist ungültig oder abgelaufen. Fordere unten einen neuen an.',
    mailSent: 'Falls ein Konto existiert, wurde eine Bestätigungs-E-Mail gesendet.',
    requestFail: 'Bestätigungs-E-Mail konnte nicht angefordert werden.',
    confirmedShort: 'E-Mail bestätigt.',
    tokenFail: 'Token konnte nicht bestätigt werden.'
  },
  en: {
    title: 'Confirm email',
    intro: 'Request a confirmation link to verify your email address.',
    emailLabel: 'Email',
    send: 'Send confirmation',
    confirmTitle: 'Confirm token',
    confirmIntro: 'Paste the token from your email.',
    checking: 'Checking link…',
    tokenLabel: 'Confirmation token',
    confirm: 'Confirm token',
    loadingFallback: 'Loading confirmation…',
    badLink: 'This confirmation link looks invalid (token too short). Request a new one below.',
    confirmed: 'Email confirmed. You can now sign in.',
    linkInvalid: 'This link is invalid or expired. Request a new one below.',
    mailSent: 'If an account exists, a confirmation email was sent.',
    requestFail: 'Could not request confirmation email.',
    confirmedShort: 'Email confirmed.',
    tokenFail: 'Could not confirm token.'
  }
};

function VerifyEmailContent() {
  const { api, user } = useCommunitySession();
  const { locale } = useLocale();
  const t = T[locale] || T.de;
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
      setError(t.badLink);
      return;
    }
    setAutoVerifying(true);
    setError('');
    setStatus('');
    api.confirmEmailVerification(tokenFromUrl.trim())
      .then(() => setStatus(t.confirmed))
      .catch((confirmError) => setError(toUserErrorMessage(confirmError, t.linkInvalid)))
      .finally(() => setAutoVerifying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setStatus(t.mailSent);
    } catch (requestError) {
      setError(toUserErrorMessage(requestError, t.requestFail));
    }
  };

  const confirmVerification = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      await api.confirmEmailVerification(token.trim());
      setStatus(t.confirmedShort);
    } catch (confirmError) {
      setError(toUserErrorMessage(confirmError, t.tokenFail));
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="mt-2 text-sm text-zinc-300">
          {t.intro}
        </p>
        <form onSubmit={requestVerification} className="mt-4 space-y-2">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder={t.emailLabel}
            aria-label={t.emailLabel}
            required
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">{t.send}</button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">{t.confirmTitle}</h2>
        <p className="mt-2 text-sm text-zinc-300">{t.confirmIntro}</p>
        {autoVerifying && <p className="mt-2 text-sm text-zinc-400">{t.checking}</p>}
        <form onSubmit={confirmVerification} className="mt-4 space-y-2">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder={t.tokenLabel}
            aria-label={t.tokenLabel}
            required
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">{t.confirm}</button>
        </form>
        <ErrorText message={error} />
        {status && <p className="mt-2 text-sm text-emerald-300">{status}</p>}
      </section>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<section className="card"><p className="text-sm text-zinc-400">…</p></section>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
