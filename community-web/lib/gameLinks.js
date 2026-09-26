// Centralised Game-platform (classic/multiplayer HTML pages) links.
//
// The Game platform is served by a separate host (`web` service on :18080).
// Use NEXT_PUBLIC_GAME_BASE to absolutise all classic/multiplayer links so
// they never resolve to 404s on the community host.

const RAW_GAME_BASE =
  process.env.NEXT_PUBLIC_GAME_BASE || 'http://localhost:18080';

function normaliseBase(value) {
  return String(value || '').replace(/\/+$/, '') || 'http://localhost:18080';
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
