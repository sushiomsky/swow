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

test('admin endpoints require admin role claim', async () => {
  db.query = async () => ({ rows: [] });
  await withServer(
    (app) => app.use('/api/community/admin', adminRoutes),
    async (baseUrl) => {
      const userResponse = await apiRequest(baseUrl, '/api/community/admin/users', {
        token: createToken('user', 'plain-user')
      });
      const adminResponse = await apiRequest(baseUrl, '/api/community/admin/users', {
        token: createToken('admin', 'admin-user')
      });
      assert.equal(userResponse.status, 403);
      assert.equal(adminResponse.status, 200);
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
