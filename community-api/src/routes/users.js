import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { emitToUser } from '../realtime.js';
import {
  getProfileById,
  getProfileByUsername,
  getRecentMatchesByUser,
  getUserAchievements,
  getUserBadges,
  submitMatchResult,
  updateUserProfile
} from '../services/usersService.js';

const router = Router();

const profileSchema = z.object({
  display_name: z.string().min(1).max(40).optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().max(280).optional()
});

router.get('/profile/:username', async (req, res, next) => {
  try {
    const profile = await getProfileByUsername(req.params.username);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    return res.json(profile);
  } catch (e) {
    return next(e);
  }
});

router.get('/profile/id/:userId', async (req, res, next) => {
  try {
    const profile = await getProfileById(req.params.userId);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    return res.json(profile);
  } catch (e) {
    return next(e);
  }
});

router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const data = profileSchema.parse(req.body || {});
    const keys = Object.keys(data);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const profile = await updateUserProfile(req.user.sub, data);
    return res.json(profile);
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues });
    return next(e);
  }
});

router.get('/matches/:userId', async (req, res, next) => {
  try {
    const rows = await getRecentMatchesByUser(req.params.userId);
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

router.get('/achievements/:userId', async (req, res, next) => {
  try {
    const achievements = await getUserAchievements(req.params.userId);
    return res.json({ achievements });
  } catch (e) {
    return next(e);
  }
});

router.get('/badges/:userId', async (req, res, next) => {
  try {
    const rows = await getUserBadges(req.params.userId);
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
    const result = await submitMatchResult(req.user.sub, payload);
    if (!result) return res.status(404).json({ error: 'User not found' });

    emitToUser(req.user.sub, 'progress_update', {
      xp: result.profile.xp,
      level: result.profile.level,
      achievements: result.profile.achievements
    });

    return res.status(201).json({ ok: true, profile: result.profile, xpGain: result.xpGain });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues });
    return next(e);
  }
});

export default router;
