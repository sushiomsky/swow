const API_BASE = process.env.NEXT_PUBLIC_COMMUNITY_API_BASE || '/api/community';

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}
