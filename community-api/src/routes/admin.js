import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { emitToAll } from '../realtime.js';
import { handleValidationError } from '../middleware/validation.js';
import {
  adjustLeaderboardScore,
  banUserForDays,
  createChallenge,
  getAnalytics,
  getPagedChatReports,
  getPagedUsers,
  getSystemHealth,
  muteUserForHours,
  resolveChatReportById
} from '../services/adminService.js';

const router = Router();

const MAX_ADMIN_PAGE_SIZE = 100;

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1),
  size: z.coerce.number().int().min(1).max(MAX_ADMIN_PAGE_SIZE)
});

const usersQuerySchema = paginationQuerySchema.extend({
  q: z.string().max(80).optional().default(''),
  role: z.enum(['user', 'admin']).optional()
});

const chatReportsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['open', 'resolved']).optional()
});

const userParamSchema = z.object({
  userId: z.string().uuid()
});

const reportParamSchema = z.object({
  reportId: z.string().uuid()
});

const muteSchema = z.object({
  hours: z.coerce.number().int().min(1).max(24 * 30).default(24)
});

const banSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7)
});

const leaderboardAdjustSchema = z.object({
  user_id: z.string().uuid(),
  season: z.string().min(1).max(64).default('current'),
  score: z.coerce.number().int().min(0).max(100000000)
});

const challengeEventSchema = z.object({
  description: z.string().min(3).max(500),
  reward: z.string().min(1).max(120),
  season: z.string().min(1).max(64).default('current'),
  start_date: z.string().min(1).max(64),
  end_date: z.string().min(1).max(64)
});

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  return next();
}

router.use(requireAuth, requireAdmin);

router.get('/users', async (req, res, next) => {
  try {
    const { q, role, page, size } = usersQuerySchema.parse(req.query || {});
    const response = await getPagedUsers({ q, role, page, size });
    return res.json(response);
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/users/:userId/mute', async (req, res, next) => {
  try {
    const { userId } = userParamSchema.parse(req.params || {});
    const { hours } = muteSchema.parse(req.body || {});
    await muteUserForHours(userId, hours);
    return res.status(204).end();
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/users/:userId/ban', async (req, res, next) => {
  try {
    const { userId } = userParamSchema.parse(req.params || {});
    const { days } = banSchema.parse(req.body || {});
    await banUserForDays(userId, days);
    return res.status(204).end();
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.get('/reports/chat', async (req, res, next) => {
  try {
    const { page, size, status } = chatReportsQuerySchema.parse(req.query || {});
    const response = await getPagedChatReports({ page, size, status });
    return res.json(response);
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/reports/chat/:reportId/resolve', async (req, res, next) => {
  try {
    const { reportId } = reportParamSchema.parse(req.params || {});
    await resolveChatReportById(reportId);
    return res.status(204).end();
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/leaderboards/adjust', async (req, res, next) => {
  try {
    const { user_id, season, score } = leaderboardAdjustSchema.parse(req.body || {});
    await adjustLeaderboardScore({ userId: user_id, season, score });
    return res.json({ ok: true });
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/events/challenges', async (req, res, next) => {
  try {
    const { description, reward, season, start_date, end_date } = challengeEventSchema.parse(req.body || {});
    const challenge = await createChallenge({
      description,
      reward,
      season,
      start_date,
      end_date
    });
    emitToAll('challenge_update', { challengeId: challenge.challenge_id });
    return res.status(201).json(challenge);
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.get('/analytics', async (_req, res, next) => {
  try {
    const snapshot = await getAnalytics();
    return res.json(snapshot);
  } catch (e) {
    return next(e);
  }
});

router.get('/health/system', async (_req, res, next) => {
  try {
    const health = await getSystemHealth();
    return res.json(health);
  } catch (e) {
    return next(e);
  }
});

export default router;
