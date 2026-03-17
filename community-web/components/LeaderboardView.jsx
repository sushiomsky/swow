'use client';

import { useEffect, useMemo, useState } from 'react';
import LeaderboardTable from './LeaderboardTable';
import { apiGet } from '../lib/api';
import { communitySocket, connectCommunitySocket } from '../lib/socket';

export default function LeaderboardView() {
  const [rows, setRows] = useState([]);
  const [scope, setScope] = useState('global');
  const [season, setSeason] = useState('current');
  const [region, setRegion] = useState('EU');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  const query = useMemo(() => {
    const params = new URLSearchParams({ scope, season, page: String(page), limit: String(limit) });
    if (scope === 'regional') params.set('region', region);
    if (scope === 'friends') params.set('userId', localStorage.getItem('communityUserId') || '');
    return `/leaderboards?${params.toString()}`;
  }, [scope, season, region, page, limit]);

  useEffect(() => {
    const run = async () => {
      const data = await apiGet(query).catch(() => ({ rows: [] }));
      setRows(data.rows || []);
    };
    run();
  }, [query]);

  useEffect(() => {
    if (!connectCommunitySocket()) return;
    const onUpdate = () => {
      apiGet(query).then((data) => setRows(data.rows || [])).catch(() => {});
    };
    communitySocket.on('leaderboard_update', onUpdate);
    communitySocket.on('leaderboard_reset', onUpdate);
    return () => {
      communitySocket.off('leaderboard_update', onUpdate);
      communitySocket.off('leaderboard_reset', onUpdate);
    };
  }, [query]);

  return (
    <div className="space-y-4">
      <section className="card flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Scope
          <select value={scope} onChange={(e) => { setPage(1); setScope(e.target.value); }} className="ml-2 rounded border border-zinc-700 bg-zinc-950 px-2 py-1">
            <option value="global">Global</option>
            <option value="regional">Regional</option>
            <option value="friends">Friends</option>
          </select>
        </label>
        <label className="text-sm">
          Season
          <input value={season} onChange={(e) => { setPage(1); setSeason(e.target.value); }} className="ml-2 rounded border border-zinc-700 bg-zinc-950 px-2 py-1" />
        </label>
        {scope === 'regional' && (
          <label className="text-sm">
            Region
            <input value={region} onChange={(e) => { setPage(1); setRegion(e.target.value); }} className="ml-2 rounded border border-zinc-700 bg-zinc-950 px-2 py-1" />
          </label>
        )}
      </section>
      <LeaderboardTable rows={rows} />
      <div className="flex gap-2">
        <button className="rounded border border-zinc-700 px-3 py-1 text-sm" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span className="px-2 py-1 text-sm text-zinc-300">Page {page}</span>
        <button className="rounded border border-zinc-700 px-3 py-1 text-sm" onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
