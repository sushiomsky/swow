'use client';

import { useEffect, useState } from 'react';
import { apiSend } from '../lib/api';

export default function AdminConsole() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [health, setHealth] = useState(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('communityToken') : null;

  const load = async () => {
    try {
      const [u, r, h] = await Promise.all([
        apiSend(`/admin/users?q=${encodeURIComponent(query)}`, 'GET', null, token),
        apiSend('/admin/reports/chat', 'GET', null, token),
        apiSend('/admin/health/system', 'GET', null, token)
      ]);
      setUsers(u || []);
      setReports(r || []);
      setHealth(h);
    } catch (_) {}
  };

  useEffect(() => { load(); }, []);

  const mute = async (id) => { await apiSend(`/admin/users/${id}/mute`, 'POST', { hours: 24 }, token); await load(); };
  const ban = async (id) => { await apiSend(`/admin/users/${id}/ban`, 'POST', { days: 7 }, token); await load(); };
  const resolveReport = async (id) => { await apiSend(`/admin/reports/chat/${id}/resolve`, 'POST', {}, token); await load(); };

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">System Health</h2>
        <p className="text-sm text-zinc-300">{health ? `DB Time: ${new Date(health.dbNow).toLocaleString()}` : 'Unavailable'}</p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">User Moderation</h2>
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" placeholder="Search user" />
          <button className="rounded border border-zinc-700 px-3 py-2 text-sm" onClick={load}>Search</button>
        </div>
        <ul className="space-y-2 text-sm">
          {users.map((u) => (
            <li key={u.user_id} className="rounded border border-zinc-700 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{u.display_name || u.username} • L{u.level} • XP {u.xp}</span>
                <div className="flex gap-2">
                  <button className="rounded border border-zinc-600 px-2 py-1 text-xs" onClick={() => mute(u.user_id)}>Mute</button>
                  <button className="rounded border border-rose-600 px-2 py-1 text-xs text-rose-300" onClick={() => ban(u.user_id)}>Ban</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">Chat Reports</h2>
        <ul className="space-y-2 text-sm">
          {reports.map((r) => (
            <li key={r.report_id} className="rounded border border-zinc-700 p-2">
              <p className="text-zinc-300">{r.content}</p>
              <p className="text-xs text-zinc-500">reason: {r.reason} • status: {r.status}</p>
              {r.status !== 'resolved' && (
                <button className="mt-2 rounded border border-zinc-600 px-2 py-1 text-xs" onClick={() => resolveReport(r.report_id)}>
                  Resolve
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
