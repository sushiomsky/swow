import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidationError } from '../middleware/validation.js';
import { enqueueSeasonRecompute } from '../services/leaderboardService.js';
import { emitToAll } from '../realtime.js';

const router = Router();
const MAX_LEADERBOARD_SCORE = 100000000;
const MAX_SCORE_JUMP_PER_SUBMISSION = 250000;
const MAX_LEADERBOARD_LIMIT = 100;
const LEADERBOARD_SCOPES = ['global', 'regional', 'friends'];
const scoreSubmitSchema = z.object({
  user_id: z.string().min(1).max(120).optional(),
  score: z.number().int().min(0).max(MAX_LEADERBOARD_SCORE),
  season: z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/).default('current')
});

const leaderboardQuerySchema = z.object({
  season: z.string().trim().min(1).max(40).default('current'),
  scope: z.enum(LEADERBOARD_SCOPES),
  region: z.string().trim().min(1).max(64).optional(),
  userId: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LEADERBOARD_LIMIT).default(25)
});

router.get('/', requireAuth, async (req, res, next) => {
  let query;
  try {
    query = leaderboardQuerySchema.parse(req.query || {});
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
  const { season, scope, region, userId, page, limit } = query;
  const offset = (page - 1) * limit;

  try {
    if (scope === 'friends') {
      // Hardening: friends-Scope nur für den eigenen Freundeskreis —
      // sonst konnte jeder das Freundes-Board jedes Users abfragen (IDOR).
      const selfId = req.user?.sub;
      if (!selfId) return res.status(401).json({ error: 'Missing authenticated user' });
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
        [season, selfId, limit, offset]
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

router.post('/score', requireAuth, async (req, res, next) => {
  try {
    const payload = scoreSubmitSchema.parse(req.body || {});
    const authedUserId = req.user?.sub;
    if (!authedUserId) return res.status(401).json({ error: 'Missing authenticated user' });
    if (payload.user_id && payload.user_id !== authedUserId) {
      return res.status(403).json({ error: 'Cannot submit score for another user' });
    }
    const userId = authedUserId;
    const season = payload.season;
    const score = payload.score;

    const current = await db.query(
      `SELECT score FROM leaderboards WHERE user_id = $1 AND season = $2 LIMIT 1`,
      [userId, season]
    );
    const existingScore = Number(current.rows?.[0]?.score || 0);
    if (score > existingScore + MAX_SCORE_JUMP_PER_SUBMISSION) {
      return res.status(422).json({
        error: 'Score jump too large; submit score via verified match flow'
      });
    }

    await db.query(
      `INSERT INTO leaderboards (user_id, score, season, rank)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (user_id, season)
       DO UPDATE SET score = GREATEST(leaderboards.score, EXCLUDED.score), updated_at = NOW()`,
      [userId, score, season]
    );
    await enqueueSeasonRecompute(season);
    return res.status(201).json({ ok: true });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues });
    return next(e);
  }
});

router.post('/season/reset', requireAuth, async (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  // Hardening: Season-Name validieren — sonst Massen-Delete per beliebigem String.
  const parsed = z.object({
    season: z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/)
  }).safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'season required (alphanumeric, max 40)' });
  }
  const season = parsed.data.season;
  try {
    await db.query(`DELETE FROM leaderboards WHERE season = $1`, [season]);
    emitToAll('leaderboard_reset', { season });
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

export default router;
