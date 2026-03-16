import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT notification_id, type, content, read_status, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [req.user.sub]
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

router.post('/:notificationId/read', requireAuth, async (req, res, next) => {
  try {
    await db.query(
      `UPDATE notifications SET read_status = true WHERE notification_id = $1 AND user_id = $2`,
      [req.params.notificationId, req.user.sub]
    );
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
});

export default router;
