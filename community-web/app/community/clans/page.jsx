'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCommunitySession } from '../../../providers/CommunitySessionProvider';
import { toUserErrorMessage } from '../../../lib/errorUtils';
import { apiGet } from '../../../lib/api';
import ErrorText from '../../../components/ErrorText';

export default function ClansIndexPage() {
  const { api, isAuthenticated } = useCommunitySession();
  const [clans, setClans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [formStatus, setFormStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiGet('/clans');
        if (!cancelled) {
          setClans(Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : []);
          setLoadError('');
        }
      } catch (error) {
        if (!cancelled) setLoadError(toUserErrorMessage(error, 'Unable to load clans.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const createClan = async (event) => {
    event.preventDefault();
    setFormError('');
    setFormStatus('');
    if (!isAuthenticated) {
      setFormError('Sign in to create a clan.');
      return;
    }
    if (name.trim().length < 3) {
      setFormError('Clan name must be at least 3 characters.');
      return;
    }
    setBusy(true);
    try {
      const created = await api.createClan(name.trim());
      setName('');
      setFormStatus(`Clan “${created?.name || name.trim()}” created.`);
      const refreshed = await apiGet('/clans').catch(() => null);
      if (refreshed) {
        setClans(Array.isArray(refreshed?.rows) ? refreshed.rows : Array.isArray(refreshed) ? refreshed : []);
      }
    } catch (error) {
      setFormError(toUserErrorMessage(error, 'Failed to create clan.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="text-2xl font-bold">Clans</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Create or join clans, chat with members, and push team standings together.
        </p>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Create a Clan</h2>
        {!isAuthenticated && (
          <p className="mt-1 text-xs text-zinc-400">Sign in to create a clan.</p>
        )}
        <form onSubmit={createClan} className="mt-3 flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-w-52 flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Clan name (min. 3 characters)"
            maxLength={80}
          />
          <button disabled={busy} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {busy ? 'Creating…' : 'Create Clan'}
          </button>
        </form>
        <ErrorText message={formError} />
        {formStatus && <p className="mt-2 text-sm text-emerald-300">{formStatus}</p>}
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">All Clans</h2>
        {loading && <p className="text-sm text-zinc-400">Loading clans…</p>}
        {!loading && loadError && <ErrorText message={loadError} />}
        {!loading && !loadError && clans.length === 0 && (
          <p className="text-sm text-zinc-400">No clans yet — be the first to create one!</p>
        )}
        {!loading && !loadError && clans.length > 0 && (
          <ul className="space-y-2">
            {clans.map((clan) => (
              <li key={clan.clan_id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{clan.name}</p>
                  <p className="text-xs text-zinc-500">
                    {clan.member_count ?? clan.members?.length ?? 0} member(s)
                  </p>
                </div>
                <Link
                  href={`/community/clans/${clan.clan_id}`}
                  className="rounded border border-indigo-600 bg-indigo-600/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30"
                >
                  View →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
