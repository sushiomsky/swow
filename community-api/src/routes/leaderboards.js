import { Router } from 'express';
import { db } from '../db.js';
import { recomputeSeasonRanks } from '../services/leaderboardService.js';

const router = Router();

router.get('/', async (req, res, next) => {
  const season = req.query.season || 'current';
  const region = req.query.region || null;
  try {
    const query = region
      ? `SELECT l.user_id, u.username, u.display_name, u.region, l.score, l.rank, l.season
         FROM leaderboards l
         JOIN users u ON u.user_id = l.user_id
         WHERE l.season = $1 AND u.region = $2
         ORDER BY l.rank ASC LIMIT 100`
      : `SELECT l.user_id, u.username, u.display_name, u.region, l.score, l.rank, l.season
         FROM leaderboards l
         JOIN users u ON u.user_id = l.user_id
         WHERE l.season = $1
         ORDER BY l.rank ASC LIMIT 100`;
    const values = region ? [season, region] : [season];
    const { rows } = await db.query(query, values);
    return res.json(rows);
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
    return res.status(201).json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

export default router;
