import { requestCommunity } from './communityClient';

export function readStoredToken() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('communityToken') || null;
  } catch {
    return null;
  }
}

export async function apiGet(path) {
  // Hardening-Folgefix: Leaderboards brauchen jetzt Auth — Token mitschicken
  // wenn vorhanden (Gäste sehen weiter global/regional? Nein: 401 → leere Rows).
  return requestCommunity(path, { method: 'GET', cache: 'no-store', token: readStoredToken() });
}
