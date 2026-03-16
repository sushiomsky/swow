export function attachCommunitySocket(io, db, redis) {
  io.on('connection', (socket) => {
    // Room model: global/match/clan channels are namespaced as "<type>:<id>".
    socket.on('join_room', ({ roomType, roomId }) => {
      if (!roomType || !roomId) return;
      socket.join(`${roomType}:${roomId}`);
    });

    // Chat message fan-out + persistence.
    socket.on('chat_message', async (payload) => {
      try {
        const { senderId, roomType, roomId, content } = payload || {};
        if (!senderId || !roomType || !roomId || !content) return;
        const { rows } = await db.query(
          `INSERT INTO chat_messages (sender_id, room_type, room_id, content)
           VALUES ($1, $2, $3, $4)
           RETURNING message_id, sender_id, room_type, room_id, content, created_at`,
          [senderId, roomType, roomId, content]
        );
        io.to(`${roomType}:${roomId}`).emit('chat_message', rows[0]);
      } catch (e) {
        socket.emit('error_event', { message: 'Failed to send chat message' });
      }
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
