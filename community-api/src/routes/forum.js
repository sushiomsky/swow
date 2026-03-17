import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidationError } from '../middleware/validation.js';

const router = Router();

const threadListQuerySchema = z.object({
  category: z.string().min(1).max(64),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const threadParamsSchema = z.object({
  threadId: z.string().uuid()
});

const threadPostParamsSchema = z.object({
  threadId: z.string().uuid(),
  postId: z.string().uuid()
});

const createThreadSchema = z.object({
  category_slug: z.string().min(1).max(64),
  title: z.string().min(4).max(160),
  body: z.string().min(4).max(5000)
});

const createPostSchema = z.object({
  body: z.string().min(1).max(5000)
});

const createCategorySchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(80),
  description: z.string().max(240).default('')
});

const moderationToggleSchema = z.object({
  value: z.boolean()
});

const moderationDeleteSchema = z.object({
  reason: z.string().min(1).max(240).optional()
});

function isModerator(role) {
  return role === 'admin' || role === 'moderator';
}

function requireModerator(req, res) {
  if (isModerator(req.user?.role)) return true;
  res.status(403).json({ error: 'Moderator only' });
  return false;
}

async function recordModerationAudit(client, { actorUserId, action, threadId = null, postId = null, details = {} }) {
  await client.query(
    `INSERT INTO forum_moderation_audit (actor_user_id, action, target_thread_id, target_post_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actorUserId, action, threadId, postId, JSON.stringify(details || {})]
  );
}

router.get('/categories', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT c.category_id, c.slug, c.name, c.description, c.created_at,
              COUNT(t.thread_id)::int AS thread_count
       FROM forum_categories c
       LEFT JOIN forum_threads t ON t.category_id = c.category_id
       GROUP BY c.category_id
       ORDER BY c.name ASC`
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

router.post('/categories', requireAuth, async (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const payload = createCategorySchema.parse(req.body || {});
    const { rows } = await db.query(
      `INSERT INTO forum_categories (slug, name, description)
       VALUES ($1, $2, $3)
       RETURNING category_id, slug, name, description, created_at`,
      [payload.slug, payload.name, payload.description]
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.get('/threads', async (req, res, next) => {
  try {
    const { category: categorySlug, page, limit } = threadListQuerySchema.parse(req.query || {});
    const offset = (page - 1) * limit;
    const { rows } = await db.query(
      `SELECT t.thread_id, t.title, t.body, t.created_at, t.updated_at, t.is_locked, t.pinned,
              c.slug AS category_slug, c.name AS category_name,
              u.user_id AS author_id, COALESCE(u.display_name, u.username, 'Unknown') AS author_name,
              COUNT(p.post_id)::int AS reply_count
       FROM forum_threads t
       JOIN forum_categories c ON c.category_id = t.category_id
       LEFT JOIN users u ON u.user_id = t.author_id
       LEFT JOIN forum_posts p ON p.thread_id = t.thread_id
       WHERE c.slug = $1
       GROUP BY t.thread_id, c.slug, c.name, u.user_id
       ORDER BY t.pinned DESC, t.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [categorySlug, limit, offset]
    );
    return res.json({ page, limit, rows });
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/threads', requireAuth, async (req, res, next) => {
  try {
    const payload = createThreadSchema.parse(req.body || {});
    const { rows: catRows } = await db.query(
      `SELECT category_id FROM forum_categories WHERE slug = $1`,
      [payload.category_slug]
    );
    if (!catRows[0]) return res.status(404).json({ error: 'Category not found' });
    const categoryId = catRows[0].category_id;
    const { rows } = await db.query(
      `INSERT INTO forum_threads (category_id, author_id, title, body)
       VALUES ($1, $2, $3, $4)
       RETURNING thread_id, title, body, created_at, updated_at, pinned, is_locked`,
      [categoryId, req.user.sub, payload.title, payload.body]
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.get('/threads/:threadId', async (req, res, next) => {
  try {
    const { threadId } = threadParamsSchema.parse(req.params || {});
    const { rows: threadRows } = await db.query(
      `SELECT t.thread_id, t.title, t.body, t.created_at, t.updated_at, t.is_locked, t.pinned,
              c.slug AS category_slug, c.name AS category_name,
              u.user_id AS author_id, COALESCE(u.display_name, u.username, 'Unknown') AS author_name
       FROM forum_threads t
       JOIN forum_categories c ON c.category_id = t.category_id
       LEFT JOIN users u ON u.user_id = t.author_id
       WHERE t.thread_id = $1`,
      [threadId]
    );
    if (!threadRows[0]) return res.status(404).json({ error: 'Thread not found' });
    const { rows: postRows } = await db.query(
      `SELECT p.post_id, p.body, p.created_at, p.updated_at,
              u.user_id AS author_id, COALESCE(u.display_name, u.username, 'Unknown') AS author_name
       FROM forum_posts p
       LEFT JOIN users u ON u.user_id = p.author_id
       WHERE p.thread_id = $1
       ORDER BY p.created_at ASC`,
      [threadId]
    );
    return res.json({ thread: threadRows[0], posts: postRows });
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/threads/:threadId/posts', requireAuth, async (req, res, next) => {
  try {
    const { threadId } = threadParamsSchema.parse(req.params || {});
    const payload = createPostSchema.parse(req.body || {});
    const { rows: threadRows } = await db.query(
      `SELECT thread_id, is_locked FROM forum_threads WHERE thread_id = $1`,
      [threadId]
    );
    if (!threadRows[0]) return res.status(404).json({ error: 'Thread not found' });
    if (threadRows[0].is_locked) return res.status(403).json({ error: 'Thread is locked' });

    const { rows } = await db.query(
      `INSERT INTO forum_posts (thread_id, author_id, body)
       VALUES ($1, $2, $3)
       RETURNING post_id, body, created_at, updated_at`,
      [threadId, req.user.sub, payload.body]
    );
    await db.query(
      `UPDATE forum_threads SET updated_at = NOW() WHERE thread_id = $1`,
      [threadId]
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/threads/:threadId/moderate/pin', requireAuth, async (req, res, next) => {
  if (!requireModerator(req, res)) return;
  try {
    const { threadId } = threadParamsSchema.parse(req.params || {});
    const { value } = moderationToggleSchema.parse(req.body || {});
    const { rows } = await db.query(
      `UPDATE forum_threads
       SET pinned = $2, updated_at = NOW()
       WHERE thread_id = $1
       RETURNING thread_id, pinned, is_locked, updated_at`,
      [threadId, value]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Thread not found' });
    await recordModerationAudit(db, {
      actorUserId: req.user.sub,
      action: value ? 'thread_pinned' : 'thread_unpinned',
      threadId,
      details: { pinned: value }
    });
    return res.json(rows[0]);
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/threads/:threadId/moderate/lock', requireAuth, async (req, res, next) => {
  if (!requireModerator(req, res)) return;
  try {
    const { threadId } = threadParamsSchema.parse(req.params || {});
    const { value } = moderationToggleSchema.parse(req.body || {});
    const { rows } = await db.query(
      `UPDATE forum_threads
       SET is_locked = $2, updated_at = NOW()
       WHERE thread_id = $1
       RETURNING thread_id, pinned, is_locked, updated_at`,
      [threadId, value]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Thread not found' });
    await recordModerationAudit(db, {
      actorUserId: req.user.sub,
      action: value ? 'thread_locked' : 'thread_unlocked',
      threadId,
      details: { is_locked: value }
    });
    return res.json(rows[0]);
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/threads/:threadId/moderate/delete', requireAuth, async (req, res, next) => {
  if (!requireModerator(req, res)) return;
  let threadId;
  let reason;
  try {
    ({ threadId } = threadParamsSchema.parse(req.params || {}));
    ({ reason } = moderationDeleteSchema.parse(req.body || {}));
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }

  const client = await db.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;
    const { rows } = await client.query(
      `DELETE FROM forum_threads
       WHERE thread_id = $1
       RETURNING thread_id`,
      [threadId]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Thread not found' });
    }
    await recordModerationAudit(client, {
      actorUserId: req.user.sub,
      action: 'thread_deleted',
      threadId,
      details: reason ? { reason } : {}
    });
    await client.query('COMMIT');
    inTransaction = false;
    return res.json({ ok: true });
  } catch (e) {
    if (inTransaction) {
      await client.query('ROLLBACK');
    }
    if (handleValidationError(res, e)) return;
    return next(e);
  } finally {
    client.release();
  }
});

router.post('/threads/:threadId/posts/:postId/moderate/delete', requireAuth, async (req, res, next) => {
  if (!requireModerator(req, res)) return;
  let threadId;
  let postId;
  let reason;
  try {
    ({ threadId, postId } = threadPostParamsSchema.parse(req.params || {}));
    ({ reason } = moderationDeleteSchema.parse(req.body || {}));
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }

  const client = await db.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;
    const { rows } = await client.query(
      `DELETE FROM forum_posts
       WHERE thread_id = $1 AND post_id = $2
       RETURNING post_id`,
      [threadId, postId]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Post not found' });
    }
    await client.query(
      `UPDATE forum_threads
       SET updated_at = NOW()
       WHERE thread_id = $1`,
      [threadId]
    );
    await recordModerationAudit(client, {
      actorUserId: req.user.sub,
      action: 'post_deleted',
      threadId,
      postId,
      details: reason ? { reason } : {}
    });
    await client.query('COMMIT');
    inTransaction = false;
    return res.json({ ok: true });
  } catch (e) {
    if (inTransaction) {
      await client.query('ROLLBACK');
    }
    if (handleValidationError(res, e)) return;
    return next(e);
  } finally {
    client.release();
  }
});

export default router;
