'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GAME_URLS, multiplayerModeUrl, spectateUrl as buildSpectateUrl } from '../lib/gameLinks';
import { useLocale } from '../providers/LocaleProvider';

// Absolute Game-host URL (ENV). The community host (:13000) does not serve
// /multiplayer/active-games — the game platform (:18080) does.
const ACTIVE_GAMES_URL =
  process.env.NEXT_PUBLIC_ACTIVE_GAMES_URL ||
  `${GAME_URLS.multiplayer.replace(/\/multiplayer\.html$/, '')}/multiplayer/active-games`;

// Capped retries: stop polling after repeated failures instead of spamming
// the console with endless 404s.
const POLL_INTERVAL_MS = 15000;
const MAX_CONSECUTIVE_FAILURES = 3;

const MODE_LABELS = {
  endless: 'Endless BR',
  sitngo: 'Sit-n-Go BR',
  'team-endless': 'Team Endless BR',
  'team-sitngo': 'Team Sit-n-Go BR',
  private: 'Private Classic',
};

const MODE_JOIN_URL = {
  endless: multiplayerModeUrl('endless'),
  sitngo: multiplayerModeUrl('sitngo'),
  'team-endless': multiplayerModeUrl('team'),
  'team-sitngo': multiplayerModeUrl('team-sitngo'),
};

const MODE_BADGE_COLOR = {
  endless: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  sitngo: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'team-endless': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'team-sitngo': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  private: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
};

const T = {
  de: {
    title: 'Live-Spiele',
    loading: 'Live-Spiele werden geladen…',
    noneActive: 'Gerade keine aktiven Spiele',
    activeGames: (n) => `${n} aktive Spiel${n === 1 ? '' : 'e'}`,
    playersOnline: (n) => `${n} Spieler online`,
    playNow: 'Jetzt spielen',
    join: 'Beitreten',
    spectate: 'Zuschauen',
    empty: 'Gerade keine aktiven Spiele — starte als Erster eines!',
    errUnavailable: 'Live-Spieldaten sind derzeit nicht verfügbar.',
    errLoad: 'Aktive Spiele konnten gerade nicht geladen werden.',
    humans: (n) => `${n} Mensch${n !== 1 ? 'en' : ''}`,
    botsOnly: 'nur Bots',
    bots: (n) => `${n} Bot${n !== 1 ? 's' : ''}`,
    queueSitngo: (n) => `Sit-n-Go: ${n} warten`,
    queueTeam: (n) => `Team Sit-n-Go: ${n} warten`,
    dungeon: 'Dungeon'
  },
  en: {
    title: 'Live Games',
    loading: 'Loading live games…',
    noneActive: 'No active games right now',
    activeGames: (n) => `${n} active game${n === 1 ? '' : 's'}`,
    playersOnline: (n) => `${n} players online`,
    playNow: 'Play now',
    join: 'Join',
    spectate: 'Spectate',
    empty: 'No active games right now — start the first one!',
    errUnavailable: 'Live game data is currently unavailable.',
    errLoad: 'Could not load active games right now.',
    humans: (n) => `${n} human${n !== 1 ? 's' : ''}`,
    botsOnly: 'bots only',
    bots: (n) => `${n} bot${n !== 1 ? 's' : ''}`,
    queueSitngo: (n) => `Sit-n-Go: ${n} waiting`,
    queueTeam: (n) => `Team Sit-n-Go: ${n} waiting`,
    dungeon: 'Dungeon'
  }
};

function formatMode(mode) {
  return MODE_LABELS[mode] || String(mode || 'Unknown').replaceAll('_', ' ');
}

function badgeClass(mode) {
  return MODE_BADGE_COLOR[mode] || MODE_BADGE_COLOR.private;
}

export default function ActiveGamesPanel() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  const [snapshot, setSnapshot] = useState({
    total_games: 0,
    total_players: 0,
    queued_sitngo_players: 0,
    queued_team_sitngo_players: 0,
    games: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const failuresRef = useRef(0);
  const timerRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch(ACTIVE_GAMES_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      failuresRef.current = 0;
      setSnapshot({
        total_games: Number(data?.total_games || 0),
        total_players: Number(data?.total_players || 0),
        queued_sitngo_players: Number(data?.queued_sitngo_players || 0),
        queued_team_sitngo_players: Number(data?.queued_team_sitngo_players || 0),
        games: Array.isArray(data?.games) ? data.games : []
      });
      setError('');
    } catch (_) {
      failuresRef.current += 1;
      if (failuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
        stopPolling();
        setError(t.errUnavailable);
      } else {
        setError(t.errLoad);
      }
    } finally {
      setLoading(false);
    }
  }, [stopPolling, t]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => stopPolling();
  }, [load, stopPolling]);

  const summary = useMemo(() => {
    if (loading) return t.loading;
    if (!snapshot.total_games) return t.noneActive;
    return `${t.activeGames(snapshot.total_games)} · ${t.playersOnline(snapshot.total_players)}`;
  }, [loading, snapshot.total_games, snapshot.total_players, t]);

  const queueNotices = [];
  if (snapshot.queued_sitngo_players > 0)
    queueNotices.push(t.queueSitngo(snapshot.queued_sitngo_players));
  if (snapshot.queued_team_sitngo_players > 0)
    queueNotices.push(t.queueTeam(snapshot.queued_team_sitngo_players));

  return (
    <section className="card border-zinc-700">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{t.title}</h2>
          <p className="mt-1 text-sm text-zinc-400">{summary}</p>
          {queueNotices.length > 0 && (
            <p className="mt-1 text-xs text-amber-300">{queueNotices.join(' · ')}</p>
          )}
        </div>
        <a href={GAME_URLS.multiplayer} className="shrink-0 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          {t.playNow}
        </a>
      </div>

      {error && <p className="mb-3 text-xs text-amber-300">{error}</p>}

      {!loading && !snapshot.games.length && !error && (
        <div className="rounded border border-zinc-800 bg-zinc-950/50 py-8 text-center text-sm text-zinc-500">
          {t.empty}
        </div>
      )}

      {!!snapshot.games.length && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {snapshot.games.map((game) => {
            const joinUrl = game.joinable ? MODE_JOIN_URL[game.mode] : null;
            const gameSpectateUrl = buildSpectateUrl(game.dungeon_id);
            const humanCount = game.players ? game.players.filter(p => !p.isBot).length : 0;
            const botCount = game.players ? game.players.filter(p => p.isBot).length : 0;

            return (
              <li key={`${game.dungeon_id}-${game.mode}`} className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${badgeClass(game.mode)}`}>
                    {formatMode(game.mode)}
                  </span>
                  <span className="text-xs text-zinc-500">{t.dungeon} {game.dungeon_id}</span>
                </div>
                <p className="text-xs text-zinc-400">
                  {humanCount > 0 ? t.humans(humanCount) : t.botsOnly}
                  {botCount > 0 ? ` · ${t.bots(botCount)}` : ''}
                  {' · '}
                  {String(game.status || 'in_progress').replaceAll('_', ' ')}
                </p>
                <div className="flex gap-2">
                  {joinUrl && (
                    <a href={joinUrl} className="flex-1 rounded border border-indigo-600 bg-indigo-600/10 py-1 text-center text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30">
                      {t.join}
                    </a>
                  )}
                  <a href={gameSpectateUrl} className="flex-1 rounded border border-zinc-700 py-1 text-center text-xs font-semibold text-zinc-300 hover:bg-zinc-800">
                    {t.spectate}
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
