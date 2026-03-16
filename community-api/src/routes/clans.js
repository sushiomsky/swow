import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/:clanId', async (req, res, next) => {
  try {
    const { rows: clans } = await db.query(`SELECT clan_id, name, stats, created_at FROM clans WHERE clan_id = $1`, [req.params.clanId]);
    if (!clans[0]) return res.status(404).json({ error: 'Clan not found' });
    const { rows: members } = await db.query(
      `SELECT user_id, username, display_name, avatar_url FROM users WHERE clan_id = $1 ORDER BY username`,
      [req.params.clanId]
    );
    return res.json({ ...clans[0], members });
  } catch (e) {
    return next(e);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO clans (name, stats) VALUES ($1, '{}'::jsonb) RETURNING clan_id, name, stats, created_at`,
      [name]
    );
    await db.query(`UPDATE users SET clan_id = $1 WHERE user_id = $2`, [rows[0].clan_id, req.user.sub]);
    return res.status(201).json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.post('/:clanId/join', requireAuth, async (req, res, next) => {
  try {
    await db.query(`UPDATE users SET clan_id = $1 WHERE user_id = $2`, [req.params.clanId, req.user.sub]);
    return res.status(204).end();
  } catch (e) {
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
