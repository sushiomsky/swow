import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
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
    if (e?.issues) return res.status(400).json({ error: e.issues });
    return next(e);
  }
});

router.get('/threads', async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query || {});
    const categorySlug = (req.query.category || '').toString();
    if (!categorySlug) return res.status(400).json({ error: 'category query parameter is required' });
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
    if (e?.issues) return res.status(400).json({ error: e.issues });
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
    if (e?.issues) return res.status(400).json({ error: e.issues });
    return next(e);
  }
});

router.get('/threads/:threadId', async (req, res, next) => {
  try {
    const { rows: threadRows } = await db.query(
      `SELECT t.thread_id, t.title, t.body, t.created_at, t.updated_at, t.is_locked, t.pinned,
              c.slug AS category_slug, c.name AS category_name,
              u.user_id AS author_id, COALESCE(u.display_name, u.username, 'Unknown') AS author_name
       FROM forum_threads t
       JOIN forum_categories c ON c.category_id = t.category_id
       LEFT JOIN users u ON u.user_id = t.author_id
       WHERE t.thread_id = $1`,
      [req.params.threadId]
    );
    if (!threadRows[0]) return res.status(404).json({ error: 'Thread not found' });
    const { rows: postRows } = await db.query(
      `SELECT p.post_id, p.body, p.created_at, p.updated_at,
              u.user_id AS author_id, COALESCE(u.display_name, u.username, 'Unknown') AS author_name
       FROM forum_posts p
       LEFT JOIN users u ON u.user_id = p.author_id
       WHERE p.thread_id = $1
       ORDER BY p.created_at ASC`,
      [req.params.threadId]
    );
    return res.json({ thread: threadRows[0], posts: postRows });
  } catch (e) {
    return next(e);
  }
});

router.post('/threads/:threadId/posts', requireAuth, async (req, res, next) => {
  try {
    const payload = createPostSchema.parse(req.body || {});
    const { rows: threadRows } = await db.query(
      `SELECT thread_id, is_locked FROM forum_threads WHERE thread_id = $1`,
      [req.params.threadId]
    );
    if (!threadRows[0]) return res.status(404).json({ error: 'Thread not found' });
    if (threadRows[0].is_locked) return res.status(403).json({ error: 'Thread is locked' });

    const { rows } = await db.query(
      `INSERT INTO forum_posts (thread_id, author_id, body)
       VALUES ($1, $2, $3)
       RETURNING post_id, body, created_at, updated_at`,
      [req.params.threadId, req.user.sub, payload.body]
    );
    await db.query(
      `UPDATE forum_threads SET updated_at = NOW() WHERE thread_id = $1`,
      [req.params.threadId]
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues });
    return next(e);
  }
});

export default router;
