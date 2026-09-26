import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { emitToUser } from '../realtime.js';

const router = Router();

// Hardening: Progress-Events begrenzen — sonst beliebig großer Progress
// und sofortiges completed_at per Riesen-Amount.
const MAX_PROGRESS_AMOUNT = 25;
const progressEventSchema = z.object({
  challengeId: z.string().trim().min(1).max(120),
  amount: z.number().positive().max(MAX_PROGRESS_AMOUNT)
});

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT challenge_id, description, reward, start_date, end_date, season
       FROM challenges WHERE NOW() BETWEEN start_date AND end_date
       ORDER BY end_date ASC`
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

router.get('/progress', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.challenge_id, p.progress, p.completed_at, c.description, c.reward
       FROM user_challenge_progress p
       JOIN challenges c ON c.challenge_id = p.challenge_id
       WHERE p.user_id = $1`,
      [req.user.sub]
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

router.post('/:challengeId/claim', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE user_challenge_progress
       SET claimed_at = NOW()
       WHERE user_id = $1 AND challenge_id = $2 AND completed_at IS NOT NULL
       RETURNING challenge_id`,
      [req.user.sub, req.params.challengeId]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Challenge not completed or already claimed' });
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

router.post('/progress-event', requireAuth, async (req, res, next) => {
  const parsed = progressEventSchema.safeParse({
    challengeId: req.body?.challengeId,
    amount: Number(req.body?.amount)
  });
  if (!parsed.success) {
    return res.status(400).json({ error: 'challengeId and positive amount (max 25) required' });
  }
  const { challengeId, amount } = parsed.data;
  try {
    const { rows } = await db.query(
      `INSERT INTO user_challenge_progress (user_id, challenge_id, progress)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, challenge_id)
       DO UPDATE SET progress = user_challenge_progress.progress + EXCLUDED.progress
       RETURNING progress`,
      [req.user.sub, challengeId, amount]
    );
    if (rows[0].progress >= 100) {
      await db.query(
        `UPDATE user_challenge_progress
         SET completed_at = COALESCE(completed_at, NOW())
         WHERE user_id = $1 AND challenge_id = $2`,
        [req.user.sub, challengeId]
      );
      emitToUser(req.user.sub, 'challenge_complete', { challengeId });
    }
    return res.json({ ok: true, progress: rows[0].progress });
  } catch (e) {
    return next(e);
  }
});

export default router;
