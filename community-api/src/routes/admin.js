import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { recomputeSeasonRanks } from '../services/leaderboardService.js';
import { emitToAll } from '../realtime.js';

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
  const hours = Number(req.body?.hours || 24);
  try {
    await db.query(`UPDATE users SET muted_until = NOW() + ($2 || ' hours')::interval WHERE user_id = $1`, [req.params.userId, hours]);
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
});

router.post('/users/:userId/ban', async (req, res, next) => {
  const days = Number(req.body?.days || 7);
  try {
    await db.query(`UPDATE users SET banned_until = NOW() + ($2 || ' days')::interval WHERE user_id = $1`, [req.params.userId, days]);
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
});

router.get('/reports/chat', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT r.report_id, r.reason, r.status, r.created_at, m.message_id, m.content, m.room_type, m.room_id
       FROM chat_reports r
       JOIN chat_messages m ON m.message_id = r.message_id
       ORDER BY r.created_at DESC`
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

router.post('/reports/chat/:reportId/resolve', async (req, res, next) => {
  try {
    await db.query(`UPDATE chat_reports SET status = 'resolved', resolved_at = NOW() WHERE report_id = $1`, [req.params.reportId]);
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
});

router.post('/leaderboards/adjust', async (req, res, next) => {
  const { user_id, season = 'current', score } = req.body || {};
  if (!user_id || typeof score !== 'number') return res.status(400).json({ error: 'user_id and score required' });
  try {
    await db.query(
      `INSERT INTO leaderboards (user_id, score, season, rank)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (user_id, season)
       DO UPDATE SET score = $2, updated_at = NOW()`,
      [user_id, score, season]
    );
    await recomputeSeasonRanks(season);
    emitToAll('leaderboard_update', { season });
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

router.post('/events/challenges', async (req, res, next) => {
  const { description, reward, season = 'current', start_date, end_date } = req.body || {};
  if (!description || !reward || !start_date || !end_date) return res.status(400).json({ error: 'Missing fields' });
  try {
    const { rows } = await db.query(
      `INSERT INTO challenges (description, reward, season, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING challenge_id, description, reward, season, start_date, end_date`,
      [description, reward, season, start_date, end_date]
    );
    emitToAll('challenge_update', { challengeId: rows[0].challenge_id });
    return res.status(201).json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.get('/analytics', async (_req, res, next) => {
  try {
    const [dau, wau, mau, topPlayers, matches] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS c FROM users WHERE last_active >= NOW() - INTERVAL '1 day'`),
      db.query(`SELECT COUNT(*)::int AS c FROM users WHERE last_active >= NOW() - INTERVAL '7 days'`),
      db.query(`SELECT COUNT(*)::int AS c FROM users WHERE last_active >= NOW() - INTERVAL '30 days'`),
      db.query(`SELECT username, xp, level FROM users ORDER BY xp DESC LIMIT 5`),
      db.query(`SELECT COUNT(*)::int AS c FROM match_results WHERE created_at >= NOW() - INTERVAL '7 days'`)
    ]);
    return res.json({
      dau: dau.rows[0].c,
      wau: wau.rows[0].c,
      mau: mau.rows[0].c,
      weeklyMatches: matches.rows[0].c,
      topPlayers: topPlayers.rows
    });
  } catch (e) {
    return next(e);
  }
});

router.get('/health/system', async (_req, res, next) => {
  try {
    const dbHealth = await db.query('SELECT NOW() AS now');
    return res.json({ ok: true, dbNow: dbHealth.rows[0].now });
  } catch (e) {
    return next(e);
  }
});

export default router;
