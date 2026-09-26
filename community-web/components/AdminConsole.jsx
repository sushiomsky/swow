'use client';

import { useEffect, useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { useLocale } from '../providers/LocaleProvider';
import { toUserErrorMessage } from '../lib/errorUtils';

const T = {
  de: {
    health: 'Systemzustand',
    unavailable: 'Nicht verfügbar',
    modTitle: 'User-Moderation',
    searchUser: 'User suchen',
    search: 'Suchen',
    mute: 'Stumm',
    ban: 'Sperren',
    reports: 'Chat-Meldungen',
    resolve: 'Erledigen',
    loadFail: 'Admin-Daten konnten nicht geladen werden.',
    needLogin: 'Melde dich als Admin an, um Moderationsdaten zu laden.'
  },
  en: {
    health: 'System Health',
    unavailable: 'Unavailable',
    modTitle: 'User Moderation',
    searchUser: 'Search user',
    search: 'Search',
    mute: 'Mute',
    ban: 'Ban',
    reports: 'Chat Reports',
    resolve: 'Resolve',
    loadFail: 'Unable to load admin data.',
    needLogin: 'Sign in as an admin user to load moderation data.'
  }
};

export default function AdminConsole() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [health, setHealth] = useState(null);
  const [status, setStatus] = useState('');
  const { api, isAuthenticated } = useCommunitySession();
  const { locale } = useLocale();
  const t = T[locale] || T.de;

  const load = async () => {
    try {
      if (!isAuthenticated) {
        setUsers([]);
        setReports([]);
        setHealth(null);
        setStatus(t.needLogin);
        return;
      }

      const [usersPage, reportsPage, systemHealth] = await Promise.all([
        api.listAdminUsers({ q: query, page: 1, size: 50 }),
        api.listAdminReports({ page: 1, size: 50 }),
        api.getAdminHealth()
      ]);
      setUsers(usersPage?.rows || []);
      setReports(reportsPage?.rows || []);
      setHealth(systemHealth);
      setStatus('');
    } catch (error) {
      setStatus(toUserErrorMessage(error, t.loadFail));
    }
  };

  useEffect(() => { load(); }, [isAuthenticated, api]);

  const mute = async (id) => { await api.muteAdminUser(id, 24); await load(); };
  const ban = async (id) => { await api.banAdminUser(id, 7); await load(); };
  const resolveReport = async (id) => { await api.resolveAdminReport(id); await load(); };

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">{t.health}</h2>
        <p className="text-sm text-zinc-300">{health ? `DB Time: ${new Date(health.dbNow).toLocaleString(locale === 'en' ? 'en-US' : 'de-DE')}` : t.unavailable}</p>
        {status && <p className="mt-2 text-xs text-amber-300">{status}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{t.modTitle}</h2>
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" placeholder={t.searchUser} aria-label={t.searchUser} />
          <button className="rounded border border-zinc-700 px-3 py-2 text-sm" onClick={load}>{t.search}</button>
        </div>
        <ul className="space-y-2 text-sm">
          {users.map((u) => (
            <li key={u.user_id} className="rounded border border-zinc-700 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{u.display_name || u.username} • L{u.level} • XP {u.xp}</span>
                <div className="flex gap-2">
                  <button className="rounded border border-zinc-600 px-2 py-1 text-xs" onClick={() => mute(u.user_id)}>{t.mute}</button>
                  <button className="rounded border border-rose-600 px-2 py-1 text-xs text-rose-300" onClick={() => ban(u.user_id)}>{t.ban}</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">{t.reports}</h2>
        <ul className="space-y-2 text-sm">
          {reports.map((r) => (
            <li key={r.report_id} className="rounded border border-zinc-700 p-2">
              <p className="text-zinc-300">{r.content}</p>
              <p className="text-xs text-zinc-500">reason: {r.reason} • status: {r.status}</p>
              {r.status !== 'resolved' && (
                <button className="mt-2 rounded border border-zinc-600 px-2 py-1 text-xs" onClick={() => resolveReport(r.report_id)}>
                  {t.resolve}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
