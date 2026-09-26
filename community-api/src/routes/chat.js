import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidationError } from '../middleware/validation.js';

const router = Router();

const roomParamsSchema = z.object({
  roomType: z.string().min(1).max(24).regex(/^[a-z_]+$/),
  roomId: z.string().min(1).max(80)
});

const reportParamsSchema = z.object({
  messageId: z.string().uuid()
});

const reportSchema = z.object({
  reason: z.string().trim().min(2).max(240).optional().default('abuse')
});

router.get('/:roomType/:roomId', requireAuth, async (req, res, next) => {
  try {
    const { roomType, roomId } = roomParamsSchema.parse(req.params || {});
    // Hardening: kein Mitlesen fremder Clan-/Match-Räume. Global + eigene
    // User-Räume bleiben lesbar; Clan/Match nur für Mitglieder.
    if (roomType === 'user' && roomId !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (roomType === 'clan') {
      // Mitgliedschaft steckt in users.clan_id (keine clan_members-Tabelle).
      const { rows: membership } = await db.query(
        `SELECT 1 FROM users WHERE user_id = $1 AND clan_id = $2 LIMIT 1`,
        [req.user.sub, roomId]
      );
      if (!membership[0]) return res.status(403).json({ error: 'Not a clan member' });
    }
    const { rows } = await db.query(
      `SELECT message_id, sender_id, room_type, room_id, content, created_at
       FROM chat_messages
       WHERE room_type = $1 AND room_id = $2
       ORDER BY created_at DESC
       LIMIT 100`,
      [roomType, roomId]
    );
    return res.json(rows.reverse());
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/report/:messageId', requireAuth, async (req, res, next) => {
  try {
    const { messageId } = reportParamsSchema.parse(req.params || {});
    const { reason } = reportSchema.parse(req.body || {});
    await db.query(
      `INSERT INTO chat_reports (message_id, reporter_id, reason)
       VALUES ($1, $2, $3)`,
      [messageId, req.user.sub, reason]
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

export default router;
