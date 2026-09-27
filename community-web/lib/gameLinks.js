// Centralised Game-platform (classic/multiplayer HTML pages) links.
//
// Local dev serves the game platform on a separate host (`web` service on
// :18080) — configure via NEXT_PUBLIC_GAME_BASE. In production the edge
// serves game pages AND the community frontend from the SAME origin, so the
// default is a relative path. Never fall back to localhost: a baked-in
// localhost URL breaks every live button (P0).

const RAW_GAME_BASE =
  process.env.NEXT_PUBLIC_GAME_BASE || '';

function normaliseBase(value) {
  return String(value || '').replace(/\/+$/, '');
}

export const GAME_BASE = normaliseBase(RAW_GAME_BASE);

export function gameUrl(path = '/') {
  const suffix = String(path || '/');
  return `${GAME_BASE}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

export const GAME_URLS = {
  classic: gameUrl('/index.html'),
  multiplayer: gameUrl('/multiplayer.html'),
  spectate: gameUrl('/spectate.html'),
  community: '/community'
};

export function spectateUrl(dungeonId) {
  if (dungeonId === undefined || dungeonId === null || dungeonId === '') {
    return GAME_URLS.spectate;
  }
  return `${GAME_URLS.spectate}?dungeon=${encodeURIComponent(String(dungeonId))}`;
}

export function multiplayerModeUrl(mode) {
  if (!mode) return GAME_URLS.multiplayer;
  return `${GAME_URLS.multiplayer}?mode=${encodeURIComponent(String(mode))}`;
}
