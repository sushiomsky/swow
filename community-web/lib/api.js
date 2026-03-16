const API_BASE = process.env.NEXT_PUBLIC_COMMUNITY_API_BASE || '/api/community';

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

export async function apiSend(path, method, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`${method} ${path} failed: ${msg}`);
  }
  if (res.status === 204) return null;
  return res.json();
}
