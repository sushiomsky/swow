'use client';

import { useEffect, useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { useLocale } from '../providers/LocaleProvider';
import { toUserErrorMessage } from '../lib/errorUtils';
import ErrorText from './ErrorText';
import Link from 'next/link';

const STRINGS = {
  de: {
    account: 'Konto',
    loadingSession: 'Sitzung wird geladen…',
    signedInAs: 'Angemeldet als',
    verified: 'bestätigt',
    notVerified: 'nicht bestätigt',
    verifyEmail: 'E-Mail bestätigen',
    resetPassword: 'Passwort zurücksetzen',
    signOut: 'Abmelden',
    signIn: 'Anmelden',
    register: 'Registrieren',
    username: 'Benutzername',
    email: 'E-Mail',
    displayName: 'Anzeigename',
    region: 'Region (optional)',
    password: 'Passwort',
    pleaseWait: 'Bitte warten…',
    createAccount: 'Konto erstellen',
    forgotPassword: 'Passwort vergessen?',
    loginFailed: 'Anmeldung fehlgeschlagen.'
  },
  en: {
    account: 'Account',
    loadingSession: 'Loading session…',
    signedInAs: 'Signed in as',
    verified: 'verified',
    notVerified: 'not verified',
    verifyEmail: 'Verify email',
    resetPassword: 'Reset password',
    signOut: 'Sign out',
    signIn: 'Sign in',
    register: 'Register',
    username: 'Username',
    email: 'Email',
    displayName: 'Display name',
    region: 'Region (optional)',
    password: 'Password',
    pleaseWait: 'Please wait…',
    createAccount: 'Create account',
    forgotPassword: 'Forgot password?',
    loginFailed: 'Sign-in failed.'
  }
};

export default function AuthPanel() {
  const { locale } = useLocale();
  const t = STRINGS[locale] || STRINGS.de;
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [region, setRegion] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const {
    user: sessionUser,
    login,
    register,
    logout,
    ready,
    sessionError,
    clearSessionError
  } = useCommunitySession();

  useEffect(() => {
    if (!sessionError) return;
    setError(sessionError);
  }, [sessionError]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    clearSessionError();
    setBusy(true);
    try {
      const payload = mode === 'register'
        ? {
          username: username.trim(),
          password,
          email: email.trim(),
          display_name: displayName.trim() || undefined,
          region: region.trim() || undefined
        }
        : { username: username.trim(), password };
      if (mode === 'register') {
        await register(payload);
      } else {
        await login(payload);
      }
      setPassword('');
    } catch (err) {
      setError(toUserErrorMessage(err, t.loginFailed));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    setPassword('');
  };

  if (!ready) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold">{t.account}</h2>
        <p className="mt-2 text-sm text-zinc-300">{t.loadingSession}</p>
      </section>
    );
  }

  if (sessionUser) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold">{t.account}</h2>
        <p className="mt-2 text-sm text-zinc-300">{t.signedInAs} <b>{sessionUser.username}</b></p>
        {sessionUser.email && (
          <p className="mt-1 text-xs text-zinc-400">
            {sessionUser.email} • {sessionUser.email_verified ? t.verified : t.notVerified}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-indigo-300">
          <Link href="/community/verify-email">{t.verifyEmail}</Link>
          <Link href="/community/reset-password">{t.resetPassword}</Link>
        </div>
        <button onClick={handleLogout} className="mt-3 rounded border border-zinc-700 px-4 py-2 text-sm">{t.signOut}</button>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setMode('login')}
          className={`rounded px-3 py-1 text-sm ${mode === 'login' ? 'bg-indigo-600' : 'border border-zinc-700'}`}
        >
          {t.signIn}
        </button>
        <button
          onClick={() => setMode('register')}
          className={`rounded px-3 py-1 text-sm ${mode === 'register' ? 'bg-indigo-600' : 'border border-zinc-700'}`}
        >
          {t.register}
        </button>
      </div>
      <form onSubmit={submit} className="space-y-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder={t.username}
          aria-label={t.username}
          required
        />
        {mode === 'register' && (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder={t.email}
              aria-label={t.email}
              required
            />
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder={t.displayName}
              aria-label={t.displayName}
            />
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder={t.region}
              aria-label={t.region}
            />
          </>
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder={t.password}
          aria-label={t.password}
          required
        />
        <ErrorText message={error} />
        <button disabled={busy} className="rounded bg-indigo-600 px-4 py-2 text-sm disabled:opacity-60">
          {busy ? t.pleaseWait : mode === 'register' ? t.createAccount : t.signIn}
        </button>
        {mode === 'login' && (
          <p className="text-xs text-indigo-300">
            <Link href="/community/reset-password">{t.forgotPassword}</Link>
          </p>
        )}
      </form>
    </section>
  );
}
