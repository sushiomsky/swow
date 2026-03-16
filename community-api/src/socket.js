const BLOCKED_TERMS = ['spam-link', 'hate-word-placeholder'];

function sanitizeContent(content) {
  let output = content;
  for (const term of BLOCKED_TERMS) {
    output = output.replaceAll(term, '***');
  }
  return output;
}

export function attachCommunitySocket(io, db, redis) {
  io.on('connection', (socket) => {
    socket.on('presence_online', ({ userId }) => {
      if (userId) io.emit('friend_presence', { userId, online: true });
    });

    socket.on('presence_offline', ({ userId }) => {
      if (userId) io.emit('friend_presence', { userId, online: false });
    });

    // Room model: global/match/clan channels are namespaced as "<type>:<id>".
    socket.on('join_room', ({ roomType, roomId }) => {
      if (!roomType || !roomId) return;
      socket.join(`${roomType}:${roomId}`);
    });

    // Chat message fan-out + persistence with lightweight term filtering.
    socket.on('chat_message', async (payload) => {
      try {
        const { senderId, roomType, roomId, content } = payload || {};
        if (!senderId || !roomType || !roomId || !content) return;
        const safeContent = sanitizeContent(content);
        const { rows } = await db.query(
          `INSERT INTO chat_messages (sender_id, room_type, room_id, content)
           VALUES ($1, $2, $3, $4)
           RETURNING message_id, sender_id, room_type, room_id, content, created_at`,
          [senderId, roomType, roomId, safeContent]
        );
        io.to(`${roomType}:${roomId}`).emit('chat_message', rows[0]);
      } catch (e) {
        socket.emit('error_event', { message: 'Failed to send chat message' });
      }
    });

    socket.on('match_update', ({ matchId, score, kills, deaths }) => {
      if (!matchId) return;
      io.to(`match:${matchId}`).emit('match_update', { matchId, score, kills, deaths });
    });

    // User-specific notifications are both persisted and published.
    socket.on('notify_user', async ({ userId, type, content }) => {
      if (!userId || !type || !content) return;
      await db.query(
        `INSERT INTO notifications (user_id, type, content) VALUES ($1, $2, $3)`,
        [userId, type, content]
      );
      await redis.publish(`notify:${userId}`, JSON.stringify({ type, content }));
      io.to(`user:${userId}`).emit('notification', { type, content });
    });

    socket.on('subscribe_notifications', ({ userId }) => {
      if (userId) socket.join(`user:${userId}`);
    });
  });
}
