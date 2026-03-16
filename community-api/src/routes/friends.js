import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT f.friend_id, u.username, u.display_name, u.avatar_url, f.status
       FROM friends f
       JOIN users u ON u.user_id = f.friend_id
       WHERE f.user_id = $1
       ORDER BY u.username ASC`,
      [req.user.sub]
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

router.post('/:friendId', requireAuth, async (req, res, next) => {
  try {
    await db.query(
      `INSERT INTO friends (user_id, friend_id, status)
       VALUES ($1, $2, 'accepted')
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
      [req.user.sub, req.params.friendId]
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

export default router;
