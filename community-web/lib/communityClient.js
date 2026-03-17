const API_BASE = process.env.NEXT_PUBLIC_COMMUNITY_API_BASE || '/api/community';

export class CommunityApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = 'CommunityApiError';
    this.status = status ?? null;
    this.details = details ?? null;
  }
}

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatRequestError(method, path, details) {
  if (details && typeof details === 'object' && details.error) {
    return `${method} ${path} failed: ${details.error}`;
  }
  if (typeof details === 'string') {
    return `${method} ${path} failed: ${details}`;
  }
  return `${method} ${path} failed`;
}

export async function requestCommunity(path, { method = 'GET', body, token, headers = {}, cache = 'no-store' } = {}) {
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache
  });

  const parsedBody = await parseResponseBody(response);
  if (!response.ok) {
    throw new CommunityApiError(formatRequestError(method, path, parsedBody), {
      status: response.status,
      details: parsedBody
    });
  }
  return parsedBody;
}

export function createCommunityApiClient({ getToken, onUnauthorized } = {}) {
  const run = async (path, options = {}) => {
    try {
      return await requestCommunity(path, options);
    } catch (error) {
      if (error instanceof CommunityApiError && error.status === 401) {
        onUnauthorized?.(error);
      }
      throw error;
    }
  };

  const runAuthed = async (path, options = {}) => {
    const token = getToken?.() || null;
    if (!token) {
      throw new CommunityApiError('Authentication required', { status: 401 });
    }
    return run(path, { ...options, token });
  };

  return {
    login: (payload) => run('/auth/login', { method: 'POST', body: payload }),
    register: (payload) => run('/auth/register', { method: 'POST', body: payload }),
    me: () => runAuthed('/auth/me'),
    requestEmailVerification: (email) => run('/auth/verify-email/request', {
      method: 'POST',
      body: { email }
    }),
    confirmEmailVerification: (token) => run('/auth/verify-email/confirm', {
      method: 'POST',
      body: { token }
    }),
    requestPasswordReset: (email) => run('/auth/password-reset/request', {
      method: 'POST',
      body: { email }
    }),
    confirmPasswordReset: ({ token, password }) => run('/auth/password-reset/confirm', {
      method: 'POST',
      body: { token, password }
    }),
    updateProfile: (payload) => runAuthed('/users/profile', { method: 'PATCH', body: payload }),
    listNotifications: () => runAuthed('/notifications'),
    listFriends: () => runAuthed('/friends'),
    sendFriendRequest: (friendId) => runAuthed(`/friends/request/${friendId}`, { method: 'POST', body: {} }),
    joinClan: (clanId) => runAuthed(`/clans/${clanId}/join`, { method: 'POST', body: {} }),
    leaveClan: () => runAuthed('/clans/leave', { method: 'POST', body: {} }),
    reportChatMessage: (messageId, reason = 'abuse') => runAuthed(`/chat/report/${messageId}`, {
      method: 'POST',
      body: { reason }
    }),
    createForumThread: (payload) => runAuthed('/forum/threads', { method: 'POST', body: payload }),
    createForumPost: (threadId, payload) => runAuthed(`/forum/threads/${threadId}/posts`, {
      method: 'POST',
      body: payload
    }),
    listAdminUsers: ({ page, size, q, role } = {}) => runAuthed(
      withQuery('/admin/users', { page, size, q, role })
    ),
    listAdminReports: ({ page, size, status } = {}) => runAuthed(
      withQuery('/admin/reports/chat', { page, size, status })
    ),
    muteAdminUser: (userId, hours = 24) => runAuthed(`/admin/users/${userId}/mute`, {
      method: 'POST',
      body: { hours }
    }),
    banAdminUser: (userId, days = 7) => runAuthed(`/admin/users/${userId}/ban`, {
      method: 'POST',
      body: { days }
    }),
    resolveAdminReport: (reportId) => runAuthed(`/admin/reports/chat/${reportId}/resolve`, {
      method: 'POST',
      body: {}
    }),
    getAdminHealth: () => runAuthed('/admin/health/system'),
    getAdminAnalytics: () => runAuthed('/admin/analytics')
  };
}
