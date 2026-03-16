import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { recomputeSeasonRanks } from '../services/leaderboardService.js';
import { emitToAll, emitToUser } from '../realtime.js';

const router = Router();

const profileSchema = z.object({
  display_name: z.string().min(1).max(40).optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().max(280).optional()
});

function computeLevel(xp) {
  return Math.max(1, Math.floor(xp / 1000) + 1);
}

function mergeAchievement(current, key) {
  const next = Array.isArray(current) ? [...current] : [];
  if (!next.includes(key)) next.push(key);
  return next;
}

router.get('/profile/:username', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT user_id, username, display_name, avatar_url, bio, xp, level, achievements, currency, region, clan_id, last_active
       FROM users WHERE username = $1`,
      [req.params.username]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.get('/profile/id/:userId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT user_id, username, display_name, avatar_url, bio, xp, level, achievements, currency, region, clan_id, last_active
       FROM users WHERE user_id = $1`,
      [req.params.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const data = profileSchema.parse(req.body || {});
    const keys = Object.keys(data);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = [...keys.map((k) => data[k]), req.user.sub];
    const { rows } = await db.query(
      `UPDATE users SET ${set}, updated_at = NOW(), last_active = NOW()
       WHERE user_id = $${keys.length + 1}
       RETURNING user_id, username, display_name, avatar_url, bio, xp, level, achievements, currency, region, clan_id, last_active`,
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
       ORDER BY created_at DESC LIMIT 50`,
      [req.params.userId]
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

router.get('/achievements/:userId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT achievements FROM users WHERE user_id = $1`,
      [req.params.userId]
    );
    return res.json({ achievements: rows[0]?.achievements || [] });
  } catch (e) {
    return next(e);
  }
});

router.get('/badges/:userId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT season, badge, created_at
       FROM seasonal_badges WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.params.userId]
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

router.post('/match-result', requireAuth, async (req, res, next) => {
  const schema = z.object({
    mode: z.string().default('ranked'),
    score: z.number().int().nonnegative(),
    kills: z.number().int().nonnegative().default(0),
    deaths: z.number().int().nonnegative().default(0),
    result: z.enum(['win', 'loss', 'draw']).default('draw'),
    season: z.string().default('current')
  });
  try {
    const payload = schema.parse(req.body || {});
    const { rows: beforeRows } = await db.query(
      `SELECT xp, achievements FROM users WHERE user_id = $1`,
      [req.user.sub]
    );
    if (!beforeRows[0]) return res.status(404).json({ error: 'User not found' });

    const xpGain = Math.max(10, Math.floor(payload.score / 20) + (payload.result === 'win' ? 50 : 0));
    const nextXp = beforeRows[0].xp + xpGain;
    const nextLevel = computeLevel(nextXp);
    let achievements = beforeRows[0].achievements || [];
    if (payload.score >= 5000) achievements = mergeAchievement(achievements, 'high-score-5000');
    if (payload.kills >= 10) achievements = mergeAchievement(achievements, 'eliminator-10');
    if (payload.result === 'win') achievements = mergeAchievement(achievements, 'first-victory');

    await db.query(
      `INSERT INTO match_results (user_id, mode, score, kills, deaths, result)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.sub, payload.mode, payload.score, payload.kills, payload.deaths, payload.result]
    );

    const { rows: updatedUsers } = await db.query(
      `UPDATE users
       SET xp = $1, level = $2, achievements = $3::jsonb, last_active = NOW(), updated_at = NOW()
       WHERE user_id = $4
       RETURNING user_id, username, display_name, xp, level, achievements`,
      [nextXp, nextLevel, JSON.stringify(achievements), req.user.sub]
    );

    await db.query(
      `INSERT INTO leaderboards (user_id, score, season, rank)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (user_id, season)
       DO UPDATE SET score = GREATEST(leaderboards.score, EXCLUDED.score), updated_at = NOW()`,
      [req.user.sub, payload.score, payload.season]
    );
    await recomputeSeasonRanks(payload.season);

    // Basic seasonal badge generation for top performers.
    if (payload.score >= 10000) {
      await db.query(
        `INSERT INTO seasonal_badges (user_id, season, badge)
         VALUES ($1, $2, 'score-10k')
         ON CONFLICT (user_id, season, badge) DO NOTHING`,
        [req.user.sub, payload.season]
      );
    }

    emitToAll('leaderboard_update', { season: payload.season });
    emitToUser(req.user.sub, 'progress_update', {
      xp: updatedUsers[0].xp,
      level: updatedUsers[0].level,
      achievements: updatedUsers[0].achievements
    });

    return res.status(201).json({ ok: true, profile: updatedUsers[0], xpGain });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues });
    return next(e);
  }
});

export default router;
