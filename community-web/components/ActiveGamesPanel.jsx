'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

function formatMode(mode) {
  switch (mode) {
    case 'classic_private_pair':
      return 'Private Classic';
    case 'sitngo_br':
      return 'Sit-n-Go BR';
    case 'team_br':
      return 'Team BR';
    case 'endless_br':
      return 'Endless BR';
    default:
      return String(mode || 'Unknown').replaceAll('_', ' ');
  }
}

export default function ActiveGamesPanel() {
  const [snapshot, setSnapshot] = useState({
    total_games: 0,
    total_players: 0,
    queued_sitngo_players: 0,
    games: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/multiplayer/active-games', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const data = await response.json();
      setSnapshot({
        total_games: Number(data?.total_games || 0),
        total_players: Number(data?.total_players || 0),
        queued_sitngo_players: Number(data?.queued_sitngo_players || 0),
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
    return () => {
      clearInterval(timer);
    };
  }, [load]);

  const summary = useMemo(() => {
    if (loading) return 'Loading active games…';
    return `${snapshot.total_games} active game${snapshot.total_games === 1 ? '' : 's'} • ${snapshot.total_players} player${snapshot.total_players === 1 ? '' : 's'}`;
  }, [loading, snapshot.total_games, snapshot.total_players]);

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Active Multiplayer Games</h2>
        <a href="/multiplayer.html" className="rounded border border-zinc-600 px-3 py-1 text-xs">Join multiplayer</a>
      </div>
      <p className="text-sm text-zinc-300">{summary}</p>
      {snapshot.queued_sitngo_players > 0 && (
        <p className="mt-1 text-xs text-zinc-400">
          Sit-n-Go queue: {snapshot.queued_sitngo_players} player{snapshot.queued_sitngo_players === 1 ? '' : 's'} waiting
        </p>
      )}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
      {!loading && !snapshot.games.length && !error && (
        <p className="mt-3 text-sm text-zinc-500">No active games right now. Start one from multiplayer.</p>
      )}
      {!!snapshot.games.length && (
        <ul className="mt-3 space-y-2 text-sm">
          {snapshot.games.map((game) => (
            <li key={`${game.dungeon_id}-${game.mode}`} className="rounded border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="font-medium text-zinc-100">{formatMode(game.mode)} • Dungeon {game.dungeon_id}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {game.player_count}/{game.max_players} players • {String(game.status || 'in_progress').replaceAll('_', ' ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
