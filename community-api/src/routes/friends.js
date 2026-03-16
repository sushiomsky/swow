import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { emitToUser } from '../realtime.js';

const router = Router();

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
    await db.query(
      `INSERT INTO friends (user_id, friend_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (user_id, friend_id)
       DO UPDATE SET status = 'pending', updated_at = NOW()`,
      [req.user.sub, req.params.friendId]
    );
    emitToUser(req.params.friendId, 'notification', {
      type: 'friend_request',
      content: `You have a friend request from ${req.user.sub}`
    });
    return res.status(201).json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

router.post('/respond/:friendId', requireAuth, async (req, res, next) => {
  const action = (req.body?.action || '').toString(); // accept | decline
  if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  try {
    const nextStatus = action === 'accept' ? 'accepted' : 'declined';
    await db.query(
      `UPDATE friends
       SET status = $1, updated_at = NOW()
       WHERE user_id = $2 AND friend_id = $3`,
      [nextStatus, req.params.friendId, req.user.sub]
    );
    if (action === 'accept') {
      await db.query(
        `INSERT INTO friends (user_id, friend_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (user_id, friend_id)
         DO UPDATE SET status = 'accepted', updated_at = NOW()`,
        [req.user.sub, req.params.friendId]
      );
    }
    return res.json({ ok: true, status: nextStatus });
  } catch (e) {
    return next(e);
  }
});

router.delete('/:friendId', requireAuth, async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [req.user.sub, req.params.friendId]
    );
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
});

export default router;
