import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidationError } from '../middleware/validation.js';
import { emitToUser } from '../realtime.js';

const router = Router();

const friendIdParamsSchema = z.object({
  friendId: z.string().uuid()
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT f.friend_id, u.username, u.display_name, u.avatar_url, f.status
       FROM friends f
       JOIN users u ON u.user_id = f.friend_id
       WHERE f.user_id = $1
       ORDER BY u.username ASC`,
      [req.user.sub]
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

router.post('/request/:friendId', requireAuth, async (req, res, next) => {
  try {
    const { friendId } = friendIdParamsSchema.parse(req.params || {});
    // Hardening: keine Self-Requests, kein Self-Friend-Row.
    if (friendId === req.user.sub) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }
    await db.query(
      `INSERT INTO friends (user_id, friend_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (user_id, friend_id)
       DO UPDATE SET status = 'pending', updated_at = NOW()`,
      [req.user.sub, friendId]
    );
    emitToUser(friendId, 'notification', {
      type: 'friend_request',
      content: `You have a friend request from ${req.user.sub}`
    });
    return res.status(201).json({ ok: true });
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/respond/:friendId', requireAuth, async (req, res, next) => {
  const action = (req.body?.action || '').toString(); // accept | decline
  if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  try {
    const { friendId } = friendIdParamsSchema.parse(req.params || {});
    const nextStatus = action === 'accept' ? 'accepted' : 'declined';
    // Hardening: nur offene Anfragen beantworten — sonst ok:true ohne Effekt.
    const { rows: updated } = await db.query(
      `UPDATE friends
       SET status = $1, updated_at = NOW()
       WHERE user_id = $2 AND friend_id = $3 AND status = 'pending'
       RETURNING friend_id`,
      [nextStatus, friendId, req.user.sub]
    );
    if (!updated[0]) {
      return res.status(404).json({ error: 'No pending friend request' });
    }
    if (action === 'accept') {
      await db.query(
        `INSERT INTO friends (user_id, friend_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (user_id, friend_id)
         DO UPDATE SET status = 'accepted', updated_at = NOW()`,
        [req.user.sub, friendId]
      );
    }
    return res.json({ ok: true, status: nextStatus });
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.delete('/:friendId', requireAuth, async (req, res, next) => {
  try {
    const { friendId } = friendIdParamsSchema.parse(req.params || {});
    await db.query(
      `DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [req.user.sub, friendId]
    );
    return res.status(204).end();
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

export default router;
