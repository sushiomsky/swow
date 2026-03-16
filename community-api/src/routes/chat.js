import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/:roomType/:roomId', requireAuth, async (req, res, next) => {
  try {
    const { roomType, roomId } = req.params;
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
    return next(e);
  }
});

export default router;
