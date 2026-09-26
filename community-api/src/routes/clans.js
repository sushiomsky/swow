import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidationError } from '../middleware/validation.js';

const router = Router();

const createClanSchema = z.object({
  name: z.string().trim().min(3).max(80)
});

const clanIdParamsSchema = z.object({
  clanId: z.string().uuid()
});

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT c.clan_id, c.name, c.stats, c.created_at,
              COUNT(u.user_id)::int AS member_count
       FROM clans c
       LEFT JOIN users u ON u.clan_id = c.clan_id
       GROUP BY c.clan_id
       ORDER BY c.created_at DESC
       LIMIT 100`
    );
    return res.json({ rows });
  } catch (e) {
    return next(e);
  }
});

router.get('/:clanId', async (req, res, next) => {
  try {
    const { clanId } = clanIdParamsSchema.parse(req.params || {});
    const { rows: clans } = await db.query(`SELECT clan_id, name, stats, created_at FROM clans WHERE clan_id = $1`, [clanId]);
    if (!clans[0]) return res.status(404).json({ error: 'Clan not found' });
    const { rows: members } = await db.query(
      `SELECT user_id, username, display_name, avatar_url FROM users WHERE clan_id = $1 ORDER BY username`,
      [clanId]
    );
    return res.json({ ...clans[0], members });
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name } = createClanSchema.parse(req.body || {});
    const { rows } = await db.query(
      `INSERT INTO clans (name, stats) VALUES ($1, '{}'::jsonb) RETURNING clan_id, name, stats, created_at`,
      [name]
    );
    await db.query(`UPDATE users SET clan_id = $1 WHERE user_id = $2`, [rows[0].clan_id, req.user.sub]);
    return res.status(201).json(rows[0]);
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/:clanId/join', requireAuth, async (req, res, next) => {
  try {
    const { clanId } = clanIdParamsSchema.parse(req.params || {});
    const { rows: existing } = await db.query(`SELECT clan_id FROM clans WHERE clan_id = $1`, [clanId]);
    if (!existing[0]) return res.status(404).json({ error: 'Clan not found' });
    await db.query(`UPDATE users SET clan_id = $1 WHERE user_id = $2`, [clanId, req.user.sub]);
    return res.status(204).end();
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/leave', requireAuth, async (req, res, next) => {
  try {
    await db.query(`UPDATE users SET clan_id = NULL WHERE user_id = $1`, [req.user.sub]);
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
});

export default router;
