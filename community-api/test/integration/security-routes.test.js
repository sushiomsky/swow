import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

process.env.COMMUNITY_JWT_SECRET = 'test-secret';
process.env.COMMUNITY_ALLOW_DEV_AUTH = 'false';
process.env.NODE_ENV = 'test';

const authRoutes = (await import('../../src/routes/auth.js')).default;
const chatRoutes = (await import('../../src/routes/chat.js')).default;
const forumRoutes = (await import('../../src/routes/forum.js')).default;
const adminRoutes = (await import('../../src/routes/admin.js')).default;
const { createApiRateLimiter } = await import('../../src/middleware/rateLimit.js');
const { db } = await import('../../src/db.js');

const originalDbQuery = db.query.bind(db);
const originalDbConnect = db.connect.bind(db);

function createToken(role = 'user', subject = 'user-1') {
  return jwt.sign(
    { sub: subject, role, username: subject },
    process.env.COMMUNITY_JWT_SECRET
  );
}

async function withServer(registerRoutes, run) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  registerRoutes(app);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: 'Internal server error', message: err?.message || String(err) });
  });

  const server = await new Promise((resolve) => {
    const handle = app.listen(0, () => resolve(handle));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function apiRequest(baseUrl, path, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const rawBody = await response.text();
  let parsedBody = null;
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsedBody = { raw: rawBody };
  }
  return { status: response.status, body: parsedBody };
}

afterEach(() => {
  db.query = originalDbQuery;
  db.connect = originalDbConnect;
});

after(async () => {
  await db.end();
});

test('auth login returns structured validation errors', async () => {
  await withServer(
    (app) => app.use('/api/community/auth', authRoutes),
    async (baseUrl) => {
      const response = await apiRequest(baseUrl, '/api/community/auth/login', {
        method: 'POST',
        body: { username: 'ab', password: '123' }
      });
      assert.equal(response.status, 400);
      assert.equal(response.body.error, 'Validation failed');
      assert.ok(Array.isArray(response.body.details));
      assert.ok(response.body.details.length > 0);
    }
  );
});

test('auth endpoints return structured 429 payloads when throttled', async () => {
  await withServer(
    (app) => {
      app.use(
        '/api/community/auth',
        createApiRateLimiter({ scope: 'auth-test', windowMs: 60_000, max: 1 }),
        authRoutes
      );
    },
    async (baseUrl) => {
      await apiRequest(baseUrl, '/api/community/auth/login', {
        method: 'POST',
        body: { username: 'ab', password: '123' }
      });
      const response = await apiRequest(baseUrl, '/api/community/auth/login', {
        method: 'POST',
        body: { username: 'ab', password: '123' }
      });
      assert.equal(response.status, 429);
      assert.equal(response.body.code, 'rate_limited');
      assert.equal(response.body.scope, 'auth-test');
      assert.equal(typeof response.body.retry_after_seconds, 'number');
    }
  );
});

test('auth verify-email request validates email payload', async () => {
  await withServer(
    (app) => app.use('/api/community/auth', authRoutes),
    async (baseUrl) => {
      const response = await apiRequest(baseUrl, '/api/community/auth/verify-email/request', {
        method: 'POST',
        body: { email: 'not-an-email' }
      });
      assert.equal(response.status, 400);
      assert.equal(response.body.error, 'Validation failed');
      assert.ok(Array.isArray(response.body.details));
      assert.equal(response.body.details[0].path, 'email');
    }
  );
});

test('password reset confirmation token is one-time use', async () => {
  let consumed = false;
  const fakeClient = {
    query: async (text) => {
      const sql = String(text);
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('UPDATE auth_action_tokens') && sql.includes('RETURNING user_id')) {
        if (consumed) return { rows: [], rowCount: 0 };
        consumed = true;
        return { rows: [{ user_id: 'user-1' }], rowCount: 1 };
      }
      if (sql.includes('UPDATE auth_credentials')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {}
  };

  db.connect = async () => fakeClient;

  await withServer(
    (app) => app.use('/api/community/auth', authRoutes),
    async (baseUrl) => {
      const payload = {
        token: 'a'.repeat(64),
        password: 'new-password-123'
      };
      const firstResponse = await apiRequest(baseUrl, '/api/community/auth/password-reset/confirm', {
        method: 'POST',
        body: payload
      });
      const secondResponse = await apiRequest(baseUrl, '/api/community/auth/password-reset/confirm', {
        method: 'POST',
        body: payload
      });

      assert.equal(firstResponse.status, 200);
      assert.equal(firstResponse.body.ok, true);
      assert.equal(secondResponse.status, 400);
      assert.equal(secondResponse.body.error, 'Invalid or expired token');
    }
  );
});

test('chat report rejects invalid message ids with structured validation errors', async () => {
  await withServer(
    (app) => app.use('/api/community/chat', chatRoutes),
    async (baseUrl) => {
      const response = await apiRequest(baseUrl, '/api/community/chat/report/not-a-uuid', {
        method: 'POST',
        token: createToken('user', 'user-chat'),
        body: { reason: 'abuse' }
      });
      assert.equal(response.status, 400);
      assert.equal(response.body.error, 'Validation failed');
      assert.ok(Array.isArray(response.body.details));
      assert.equal(response.body.details[0].path, 'messageId');
    }
  );
});

test('forum threads endpoint requires category query parameter', async () => {
  await withServer(
    (app) => app.use('/api/community/forum', forumRoutes),
    async (baseUrl) => {
      const response = await apiRequest(baseUrl, '/api/community/forum/threads');
      assert.equal(response.status, 400);
      assert.equal(response.body.error, 'Validation failed');
      assert.ok(Array.isArray(response.body.details));
      assert.equal(response.body.details[0].path, 'category');
    }
  );
});

test('forum moderation actions return 403 for non-moderators', async () => {
  await withServer(
    (app) => app.use('/api/community/forum', forumRoutes),
    async (baseUrl) => {
      const response = await apiRequest(
        baseUrl,
        '/api/community/forum/threads/11111111-1111-1111-1111-111111111111/moderate/pin',
        {
          method: 'POST',
          token: createToken('user', 'plain-user'),
          body: { value: true }
        }
      );
      assert.equal(response.status, 403);
      assert.equal(response.body.error, 'Moderator only');
    }
  );
});

test('forum moderator pin action writes moderation audit', async () => {
  const calls = [];
  db.query = async (text, params = []) => {
    const sql = String(text);
    calls.push({ sql, params });
    if (sql.includes('UPDATE forum_threads')) {
      return {
        rows: [{
          thread_id: params[0],
          pinned: params[1],
          is_locked: false,
          updated_at: new Date().toISOString()
        }],
        rowCount: 1
      };
    }
    if (sql.includes('INSERT INTO forum_moderation_audit')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await withServer(
    (app) => app.use('/api/community/forum', forumRoutes),
    async (baseUrl) => {
      const threadId = '22222222-2222-2222-2222-222222222222';
      const response = await apiRequest(
        baseUrl,
        `/api/community/forum/threads/${threadId}/moderate/pin`,
        {
          method: 'POST',
          token: createToken('moderator', 'mod-user'),
          body: { value: true }
        }
      );
      assert.equal(response.status, 200);
      assert.equal(response.body.thread_id, threadId);
      assert.equal(response.body.pinned, true);
      const auditCall = calls.find((call) => call.sql.includes('INSERT INTO forum_moderation_audit'));
      assert.ok(auditCall);
      assert.equal(auditCall.params[0], 'mod-user');
      assert.equal(auditCall.params[1], 'thread_pinned');
      assert.equal(auditCall.params[2], threadId);
    }
  );
});

test('admin endpoints require admin role claim', async () => {
  db.query = async (text) => {
    if (String(text).includes('COUNT(*)::int AS total')) {
      return { rows: [{ total: 0 }] };
    }
    return { rows: [] };
  };
  await withServer(
    (app) => app.use('/api/community/admin', adminRoutes),
    async (baseUrl) => {
      const userResponse = await apiRequest(baseUrl, '/api/community/admin/users?page=1&size=10', {
        token: createToken('user', 'plain-user')
      });
      const adminResponse = await apiRequest(baseUrl, '/api/community/admin/users?page=1&size=10', {
        token: createToken('admin', 'admin-user')
      });
      assert.equal(userResponse.status, 403);
      assert.equal(adminResponse.status, 200);
      assert.equal(adminResponse.body.page, 1);
      assert.equal(adminResponse.body.size, 10);
      assert.ok(Array.isArray(adminResponse.body.rows));
    }
  );
});

test('admin report endpoints require bounded page and size query params', async () => {
  await withServer(
    (app) => app.use('/api/community/admin', adminRoutes),
    async (baseUrl) => {
      const missingPagination = await apiRequest(baseUrl, '/api/community/admin/reports/chat', {
        token: createToken('admin', 'admin-user')
      });
      const oversizedPageSize = await apiRequest(baseUrl, '/api/community/admin/reports/chat?page=1&size=999', {
        token: createToken('admin', 'admin-user')
      });
      assert.equal(missingPagination.status, 400);
      assert.equal(missingPagination.body.error, 'Validation failed');
      assert.equal(oversizedPageSize.status, 400);
      assert.equal(oversizedPageSize.body.error, 'Validation failed');
    }
  );
});

test('admin reports include paging metadata when page and size are provided', async () => {
  db.query = async (text) => {
    if (String(text).includes('COUNT(*)::int AS total')) {
      return { rows: [{ total: 1 }] };
    }
    return {
      rows: [
        {
          report_id: 'report-1',
          reason: 'abuse',
          status: 'open',
          created_at: new Date().toISOString(),
          message_id: 'message-1',
          content: 'test message',
          room_type: 'global',
          room_id: 'main'
        }
      ]
    };
  };

  await withServer(
    (app) => app.use('/api/community/admin', adminRoutes),
    async (baseUrl) => {
      const response = await apiRequest(baseUrl, '/api/community/admin/reports/chat?page=1&size=10', {
        token: createToken('admin', 'admin-user')
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.page, 1);
      assert.equal(response.body.size, 10);
      assert.equal(response.body.total, 1);
      assert.equal(response.body.totalPages, 1);
      assert.ok(Array.isArray(response.body.rows));
      assert.equal(response.body.rows.length, 1);
    }
  );
});

test('admin leaderboard adjust validates payload shape', async () => {
  await withServer(
    (app) => app.use('/api/community/admin', adminRoutes),
    async (baseUrl) => {
      const response = await apiRequest(baseUrl, '/api/community/admin/leaderboards/adjust', {
        method: 'POST',
        token: createToken('admin', 'admin-user'),
        body: { user_id: 'bad-id', score: -10 }
      });
      assert.equal(response.status, 400);
      assert.equal(response.body.error, 'Validation failed');
      assert.ok(Array.isArray(response.body.details));
      assert.ok(response.body.details.length >= 1);
    }
  );
});
