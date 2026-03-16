import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { recomputeSeasonRanks } from '../services/leaderboardService.js';
import { emitToAll } from '../realtime.js';

const router = Router();

router.get('/', async (req, res, next) => {
  const season = (req.query.season || 'current').toString();
  const scope = (req.query.scope || 'global').toString(); // global | regional | friends
  const region = req.query.region ? req.query.region.toString() : null;
  const userId = req.query.userId ? req.query.userId.toString() : null;
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
  const offset = (page - 1) * limit;

  try {
    if (scope === 'friends') {
      if (!userId) return res.status(400).json({ error: 'userId required for friends scope' });
      const { rows } = await db.query(
        `SELECT l.user_id, u.username, u.display_name, u.region, l.score, l.rank, l.season
         FROM leaderboards l
         JOIN users u ON u.user_id = l.user_id
         WHERE l.season = $1
           AND (
             l.user_id = $2 OR
             l.user_id IN (
               SELECT friend_id FROM friends WHERE user_id = $2 AND status = 'accepted'
             )
           )
         ORDER BY l.rank ASC
         LIMIT $3 OFFSET $4`,
        [season, userId, limit, offset]
      );
      return res.json({ page, limit, rows });
    }

    if (scope === 'regional') {
      if (!region) return res.status(400).json({ error: 'region required for regional scope' });
      const { rows } = await db.query(
        `SELECT l.user_id, u.username, u.display_name, u.region, l.score, l.rank, l.season
         FROM leaderboards l
         JOIN users u ON u.user_id = l.user_id
         WHERE l.season = $1 AND u.region = $2
         ORDER BY l.rank ASC
         LIMIT $3 OFFSET $4`,
        [season, region, limit, offset]
      );
      return res.json({ page, limit, rows });
    }

    const { rows } = await db.query(
      `SELECT l.user_id, u.username, u.display_name, u.region, l.score, l.rank, l.season
       FROM leaderboards l
       JOIN users u ON u.user_id = l.user_id
       WHERE l.season = $1
       ORDER BY l.rank ASC
       LIMIT $2 OFFSET $3`,
      [season, limit, offset]
    );
    return res.json({ page, limit, rows });
  } catch (e) {
    return next(e);
  }
});

router.post('/score', async (req, res, next) => {
  const { user_id, score, season = 'current' } = req.body || {};
  if (!user_id || typeof score !== 'number') return res.status(400).json({ error: 'user_id and score required' });
  try {
    await db.query(
      `INSERT INTO leaderboards (user_id, score, season, rank)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (user_id, season)
       DO UPDATE SET score = GREATEST(leaderboards.score, EXCLUDED.score), updated_at = NOW()`,
      [user_id, score, season]
    );
    await recomputeSeasonRanks(season);
    emitToAll('leaderboard_update', { season });
    return res.status(201).json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

router.post('/season/reset', requireAuth, async (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const season = (req.body?.season || '').toString();
  if (!season) return res.status(400).json({ error: 'season required' });
  try {
    await db.query(`DELETE FROM leaderboards WHERE season = $1`, [season]);
    emitToAll('leaderboard_reset', { season });
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

export default router;
