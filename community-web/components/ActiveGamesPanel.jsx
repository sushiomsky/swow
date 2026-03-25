'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const MODE_LABELS = {
  endless: 'Endless BR',
  sitngo: 'Sit-n-Go BR',
  'team-endless': 'Team Endless BR',
  'team-sitngo': 'Team Sit-n-Go BR',
  private: 'Private Classic',
};

const MODE_JOIN_URL = {
  endless: '/multiplayer.html?mode=endless',
  sitngo: '/multiplayer.html?mode=sitngo',
  'team-endless': '/multiplayer.html?mode=team',
  'team-sitngo': '/multiplayer.html?mode=team-sitngo',
};

const MODE_BADGE_COLOR = {
  endless: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  sitngo: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'team-endless': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'team-sitngo': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  private: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
};

function formatMode(mode) {
  return MODE_LABELS[mode] || String(mode || 'Unknown').replaceAll('_', ' ');
}

function badgeClass(mode) {
  return MODE_BADGE_COLOR[mode] || MODE_BADGE_COLOR.private;
}

export default function ActiveGamesPanel() {
  const [snapshot, setSnapshot] = useState({
    total_games: 0,
    total_players: 0,
    queued_sitngo_players: 0,
    queued_team_sitngo_players: 0,
    games: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/multiplayer/active-games', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      setSnapshot({
        total_games: Number(data?.total_games || 0),
        total_players: Number(data?.total_players || 0),
        queued_sitngo_players: Number(data?.queued_sitngo_players || 0),
        queued_team_sitngo_players: Number(data?.queued_team_sitngo_players || 0),
        games: Array.isArray(data?.games) ? data.games : []
      });
      setError('');
    } catch (_) {
      setError('Unable to load active games right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const summary = useMemo(() => {
    if (loading) return 'Loading active games…';
    if (!snapshot.total_games) return 'No active games right now';
    return `${snapshot.total_games} active game${snapshot.total_games === 1 ? '' : 's'} · ${snapshot.total_players} player${snapshot.total_players === 1 ? '' : 's'} online`;
  }, [loading, snapshot.total_games, snapshot.total_players]);

  const queueNotices = [];
  if (snapshot.queued_sitngo_players > 0)
    queueNotices.push(`Sit-n-Go: ${snapshot.queued_sitngo_players} waiting`);
  if (snapshot.queued_team_sitngo_players > 0)
    queueNotices.push(`Team Sit-n-Go: ${snapshot.queued_team_sitngo_players} waiting`);

  return (
    <section className="card border-zinc-700">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Live Games</h2>
          <p className="mt-1 text-sm text-zinc-400">{summary}</p>
          {queueNotices.length > 0 && (
            <p className="mt-1 text-xs text-amber-300">{queueNotices.join(' · ')}</p>
          )}
        </div>
        <a href="/multiplayer.html" className="shrink-0 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          Play Now
        </a>
      </div>

      {error && <p className="mb-3 text-xs text-amber-300">{error}</p>}

      {!loading && !snapshot.games.length && !error && (
        <div className="rounded border border-zinc-800 bg-zinc-950/50 py-8 text-center text-sm text-zinc-500">
          No active games right now — be the first to start one!
        </div>
      )}

      {!!snapshot.games.length && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {snapshot.games.map((game) => {
            const joinUrl = game.joinable ? MODE_JOIN_URL[game.mode] : null;
            const spectateUrl = `/spectate.html?dungeon=${game.dungeon_id}`;
            const humanCount = game.players ? game.players.filter(p => !p.isBot).length : 0;
            const botCount = game.players ? game.players.filter(p => p.isBot).length : 0;

            return (
              <li key={`${game.dungeon_id}-${game.mode}`} className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${badgeClass(game.mode)}`}>
                    {formatMode(game.mode)}
                  </span>
                  <span className="text-xs text-zinc-500">Dungeon {game.dungeon_id}</span>
                </div>
                <p className="text-xs text-zinc-400">
                  {humanCount > 0 ? `${humanCount} human${humanCount !== 1 ? 's' : ''}` : 'bots only'}
                  {botCount > 0 ? ` · ${botCount} bot${botCount !== 1 ? 's' : ''}` : ''}
                  {' · '}
                  {String(game.status || 'in_progress').replaceAll('_', ' ')}
                </p>
                <div className="flex gap-2">
                  {joinUrl && (
                    <a href={joinUrl} className="flex-1 rounded border border-indigo-600 bg-indigo-600/10 py-1 text-center text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30">
                      Join
                    </a>
                  )}
                  <a href={spectateUrl} className="flex-1 rounded border border-zinc-700 py-1 text-center text-xs font-semibold text-zinc-300 hover:bg-zinc-800">
                    Spectate
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
