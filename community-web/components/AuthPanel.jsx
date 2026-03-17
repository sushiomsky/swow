'use client';

import { useEffect, useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { toUserErrorMessage } from '../lib/errorUtils';
import ErrorText from './ErrorText';
import Link from 'next/link';

export default function AuthPanel() {
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
      setError(toUserErrorMessage(err, 'Authentication failed.'));
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
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="mt-2 text-sm text-zinc-300">Loading session...</p>
      </section>
    );
  }

  if (sessionUser) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="mt-2 text-sm text-zinc-300">Signed in as <b>{sessionUser.username}</b></p>
        {sessionUser.email && (
          <p className="mt-1 text-xs text-zinc-400">
            {sessionUser.email} • {sessionUser.email_verified ? 'verified' : 'not verified'}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-indigo-300">
          <Link href="/community/verify-email">Verify email</Link>
          <Link href="/community/reset-password">Reset password</Link>
        </div>
        <button onClick={handleLogout} className="mt-3 rounded border border-zinc-700 px-4 py-2 text-sm">Log out</button>
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
          Login
        </button>
        <button
          onClick={() => setMode('register')}
          className={`rounded px-3 py-1 text-sm ${mode === 'register' ? 'bg-indigo-600' : 'border border-zinc-700'}`}
        >
          Register
        </button>
      </div>
      <form onSubmit={submit} className="space-y-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Username"
          required
        />
        {mode === 'register' && (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Email"
              required
            />
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Display name"
            />
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Region (optional)"
            />
          </>
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Password"
          required
        />
        <ErrorText message={error} />
        <button disabled={busy} className="rounded bg-indigo-600 px-4 py-2 text-sm disabled:opacity-60">
          {busy ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Sign in'}
        </button>
        {mode === 'login' && (
          <p className="text-xs text-indigo-300">
            <Link href="/community/reset-password">Forgot password?</Link>
          </p>
        )}
      </form>
    </section>
  );
}
