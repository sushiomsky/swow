'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ErrorText from '../../../components/ErrorText';
import { useCommunitySession } from '../../../providers/CommunitySessionProvider';
import { useLocale } from '../../../providers/LocaleProvider';
import { toUserErrorMessage } from '../../../lib/errorUtils';

const T = {
  de: {
    title: 'Passwort zurücksetzen',
    intro: 'Fordere ein Token für deine Konto-E-Mail an.',
    emailLabel: 'E-Mail',
    sendToken: 'Token senden',
    confirmTitle: 'Zurücksetzen bestätigen',
    confirmIntro: 'Token und neues Passwort eingeben.',
    tokenLabel: 'Reset-Token',
    newPassword: 'Neues Passwort',
    confirmPassword: 'Passwort bestätigen',
    reset: 'Passwort zurücksetzen',
    loadingFallback: 'Zurücksetzen wird geladen…',
    mailSent: 'Falls ein Konto existiert, wurde eine E-Mail zum Zurücksetzen gesendet.',
    requestFail: 'Zurücksetzen konnte nicht angefordert werden.',
    mismatch: 'Passwörter stimmen nicht überein.',
    done: 'Passwort zurückgesetzt. Du kannst dich jetzt mit dem neuen Passwort anmelden.',
    confirmFail: 'Passwort konnte nicht zurückgesetzt werden.'
  },
  en: {
    title: 'Reset password',
    intro: 'Request a token for your account email.',
    emailLabel: 'Email',
    sendToken: 'Send token',
    confirmTitle: 'Confirm reset',
    confirmIntro: 'Enter the token and a new password.',
    tokenLabel: 'Reset token',
    newPassword: 'New password',
    confirmPassword: 'Confirm password',
    reset: 'Reset password',
    loadingFallback: 'Loading reset…',
    mailSent: 'If an account exists, a reset email was sent.',
    requestFail: 'Could not request reset.',
    mismatch: 'Passwords do not match.',
    done: 'Password reset. You can now sign in with the new password.',
    confirmFail: 'Could not reset password.'
  }
};

function ResetPasswordContent() {
  const { api, user } = useCommunitySession();
  const { locale } = useLocale();
  const t = T[locale] || T.de;
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
      setStatus(t.mailSent);
    } catch (requestError) {
      setError(toUserErrorMessage(requestError, t.requestFail));
    }
  };

  const confirmReset = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    if (password !== confirmPassword) {
      setError(t.mismatch);
      return;
    }
    try {
      await api.confirmPasswordReset({ token: token.trim(), password });
      setStatus(t.done);
      setPassword('');
      setConfirmPassword('');
    } catch (confirmError) {
      setError(toUserErrorMessage(confirmError, t.confirmFail));
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="mt-2 text-sm text-zinc-300">
          {t.intro}
        </p>
        <form onSubmit={requestReset} className="mt-4 space-y-2">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder={t.emailLabel}
            aria-label={t.emailLabel}
            required
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">{t.sendToken}</button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">{t.confirmTitle}</h2>
        <p className="mt-2 text-sm text-zinc-300">{t.confirmIntro}</p>
        <form onSubmit={confirmReset} className="mt-4 space-y-2">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder={t.tokenLabel}
            aria-label={t.tokenLabel}
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder={t.newPassword}
            aria-label={t.newPassword}
            minLength={8}
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder={t.confirmPassword}
            aria-label={t.confirmPassword}
            minLength={8}
            required
          />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">{t.reset}</button>
        </form>
        <ErrorText message={error} />
        {status && <p className="mt-2 text-sm text-emerald-300">{status}</p>}
      </section>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<section className="card"><p className="text-sm text-zinc-400">…</p></section>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
