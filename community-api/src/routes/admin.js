import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  return next();
}

router.use(requireAuth, requireAdmin);

router.get('/users', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString();
    const { rows } = await db.query(
      `SELECT user_id, username, display_name, level, xp, region, muted_until, banned_until
       FROM users
       WHERE username ILIKE $1 OR display_name ILIKE $1
       ORDER BY last_active DESC NULLS LAST
       LIMIT 200`,
      [`%${q}%`]
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

router.post('/users/:userId/mute', async (req, res, next) => {
  try {
    await db.query(`UPDATE users SET muted_until = NOW() + INTERVAL '24 hours' WHERE user_id = $1`, [req.params.userId]);
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
});

router.post('/users/:userId/ban', async (req, res, next) => {
  try {
    await db.query(`UPDATE users SET banned_until = NOW() + INTERVAL '7 days' WHERE user_id = $1`, [req.params.userId]);
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
});

router.get('/analytics', async (_req, res, next) => {
  try {
    const [dau, wau, mau] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS c FROM users WHERE last_active >= NOW() - INTERVAL '1 day'`),
      db.query(`SELECT COUNT(*)::int AS c FROM users WHERE last_active >= NOW() - INTERVAL '7 days'`),
      db.query(`SELECT COUNT(*)::int AS c FROM users WHERE last_active >= NOW() - INTERVAL '30 days'`)
    ]);
    return res.json({
      dau: dau.rows[0].c,
      wau: wau.rows[0].c,
      mau: mau.rows[0].c
    });
  } catch (e) {
    return next(e);
  }
});

export default router;
