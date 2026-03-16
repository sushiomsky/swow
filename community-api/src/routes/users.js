import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/profile/:username', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT user_id, username, display_name, avatar_url, bio, xp, level, achievements, currency, region, last_active
       FROM users WHERE username = $1`,
      [req.params.username]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.patch('/profile', requireAuth, async (req, res, next) => {
  const schema = z.object({
    display_name: z.string().min(1).max(40).optional(),
    avatar_url: z.string().url().optional(),
    bio: z.string().max(280).optional()
  });
  try {
    const data = schema.parse(req.body || {});
    const keys = Object.keys(data);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = [...keys.map((k) => data[k]), req.user.sub];
    const { rows } = await db.query(
      `UPDATE users SET ${set}, updated_at = NOW() WHERE user_id = $${keys.length + 1}
       RETURNING user_id, username, display_name, avatar_url, bio, xp, level, achievements, currency, region, last_active`,
      values
    );
    return res.json(rows[0]);
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues });
    return next(e);
  }
});

router.get('/matches/:userId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT match_id, mode, score, kills, deaths, result, created_at
       FROM match_results WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.params.userId]
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

export default router;
