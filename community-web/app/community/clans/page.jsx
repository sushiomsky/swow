'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCommunitySession } from '../../../providers/CommunitySessionProvider';
import { useLocale } from '../../../providers/LocaleProvider';
import { toUserErrorMessage } from '../../../lib/errorUtils';
import { apiGet } from '../../../lib/api';
import ErrorText from '../../../components/ErrorText';

const T = {
  de: {
    title: 'Clans',
    intro: 'Gründe Clans oder tritt bei, chatte mit Mitgliedern und steigt gemeinsam auf.',
    createTitle: 'Clan gründen',
    signInHint: 'Melde dich an, um einen Clan zu gründen.',
    namePlaceholder: 'Clan-Name (min. 3 Zeichen)',
    nameLabel: 'Clan-Name',
    create: 'Clan gründen',
    creating: 'Wird gegründet…',
    created: (name) => `Clan „${name}“ gegründet.`,
    needLogin: 'Melde dich an, um einen Clan zu gründen.',
    nameTooShort: 'Clan-Name muss mindestens 3 Zeichen haben.',
    loadFail: 'Clans konnten nicht geladen werden.',
    createFail: 'Clan konnte nicht gegründet werden.',
    allClans: 'Alle Clans',
    loading: 'Clans werden geladen…',
    empty: 'Noch keine Clans — gründe den ersten!',
    member: (n) => `${n} Mitglied(er)`,
    view: 'Ansehen →'
  },
  en: {
    title: 'Clans',
    intro: 'Found clans or join one, chat with members and climb the ranks together.',
    createTitle: 'Found a clan',
    signInHint: 'Sign in to found a clan.',
    namePlaceholder: 'Clan name (min. 3 characters)',
    nameLabel: 'Clan name',
    create: 'Found clan',
    creating: 'Founding…',
    created: (name) => `Clan "${name}" founded.`,
    needLogin: 'Sign in to found a clan.',
    nameTooShort: 'Clan name must be at least 3 characters.',
    loadFail: 'Could not load clans.',
    createFail: 'Could not found clan.',
    allClans: 'All clans',
    loading: 'Loading clans…',
    empty: 'No clans yet — found the first one!',
    member: (n) => `${n} member(s)`,
    view: 'View →'
  }
};

export default function ClansIndexPage() {
  const { api, isAuthenticated } = useCommunitySession();
  const { locale } = useLocale();
  const t = T[locale] || T.de;
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
        if (!cancelled) setLoadError(toUserErrorMessage(error, t.loadFail));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [t.loadFail]);

  const createClan = async (event) => {
    event.preventDefault();
    setFormError('');
    setFormStatus('');
    if (!isAuthenticated) {
      setFormError(t.needLogin);
      return;
    }
    if (name.trim().length < 3) {
      setFormError(t.nameTooShort);
      return;
    }
    setBusy(true);
    try {
      const created = await api.createClan(name.trim());
      setName('');
      setFormStatus(t.created(created?.name || name.trim()));
      const refreshed = await apiGet('/clans').catch(() => null);
      if (refreshed) {
        setClans(Array.isArray(refreshed?.rows) ? refreshed.rows : Array.isArray(refreshed) ? refreshed : []);
      }
    } catch (error) {
      setFormError(toUserErrorMessage(error, t.createFail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="mt-2 text-sm text-zinc-300">
          {t.intro}
        </p>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">{t.createTitle}</h2>
        {!isAuthenticated && (
          <p className="mt-1 text-xs text-zinc-400">{t.signInHint}</p>
        )}
        <form onSubmit={createClan} className="mt-3 flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-w-52 flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder={t.namePlaceholder}
            aria-label={t.nameLabel}
            maxLength={80}
          />
          <button disabled={busy} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {busy ? t.creating : t.create}
          </button>
        </form>
        <ErrorText message={formError} />
        {formStatus && <p className="mt-2 text-sm text-emerald-300">{formStatus}</p>}
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">{t.allClans}</h2>
        {loading && <p className="text-sm text-zinc-400">{t.loading}</p>}
        {!loading && loadError && <ErrorText message={loadError} />}
        {!loading && !loadError && clans.length === 0 && (
          <p className="text-sm text-zinc-400">{t.empty}</p>
        )}
        {!loading && !loadError && clans.length > 0 && (
          <ul className="space-y-2">
            {clans.map((clan) => (
              <li key={clan.clan_id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{clan.name}</p>
                  <p className="text-xs text-zinc-500">
                    {t.member(clan.member_count ?? clan.members?.length ?? 0)}
                  </p>
                </div>
                <Link
                  href={`/community/clans/${clan.clan_id}`}
                  className="rounded border border-indigo-600 bg-indigo-600/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30"
                >
                  {t.view}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
