import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { createRequestId, logError, logInfo, logWarn } from './logger.js';

const BLOCKED_TERMS = ['spam-link', 'hate-word-placeholder'];

function sanitizeContent(content) {
  let output = content;
  for (const term of BLOCKED_TERMS) {
    output = output.replaceAll(term, '***');
  }
  return output;
}

function readSocketToken(socket) {
  const authToken = socket.handshake?.auth?.token;
  if (typeof authToken === 'string' && authToken) return authToken;
  const authHeader = socket.handshake?.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export function attachCommunitySocket(io, db, redis) {
  io.use((socket, next) => {
    const token = readSocketToken(socket);
    if (!token) {
      logWarn('socket_auth_missing_token', {
        socket_id: socket.id,
        remote_address: socket.handshake?.address || null
      });
      return next(new Error('Missing bearer token'));
    }
    try {
      const claims = jwt.verify(token, config.jwtSecret);
      socket.data.user = claims;
      socket.data.connectionId = createRequestId();
      return next();
    } catch (e) {
      logWarn('socket_auth_invalid_token', {
        socket_id: socket.id,
        remote_address: socket.handshake?.address || null
      });
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data?.user?.sub;
    if (!userId) {
      logWarn('socket_connection_missing_user', { socket_id: socket.id });
      socket.disconnect(true);
      return;
    }
    const connectionId = socket.data.connectionId || createRequestId();
    logInfo('socket_connected', {
      connection_id: connectionId,
      socket_id: socket.id,
      user_id: userId
    });

    socket.on('disconnect', (reason) => {
      logInfo('socket_disconnected', {
        connection_id: connectionId,
        socket_id: socket.id,
        user_id: userId,
        reason
      });
    });

    socket.on('presence_online', () => {
      io.emit('friend_presence', { userId, online: true });
    });

    socket.on('presence_offline', () => {
      io.emit('friend_presence', { userId, online: false });
    });

    // Room model: global/match/clan channels are namespaced as "<type>:<id>".
    socket.on('join_room', ({ roomType, roomId } = {}) => {
      if (!roomType || !roomId) return;
      if (roomType === 'user' && roomId !== userId) return;
      socket.join(`${roomType}:${roomId}`);
    });

    // Chat message fan-out + persistence with lightweight term filtering.
    socket.on('chat_message', async (payload) => {
      try {
        const { roomType, roomId, content } = payload || {};
        if (!roomType || !roomId || typeof content !== 'string' || !content.trim()) return;
        const safeContent = sanitizeContent(content.trim().slice(0, 1000));
        const { rows } = await db.query(
          `INSERT INTO chat_messages (sender_id, room_type, room_id, content)
           VALUES ($1, $2, $3, $4)
           RETURNING message_id, sender_id, room_type, room_id, content, created_at`,
          [userId, roomType, roomId, safeContent]
        );
        io.to(`${roomType}:${roomId}`).emit('chat_message', rows[0]);
      } catch (e) {
        logError('socket_chat_message_failed', e, {
          connection_id: connectionId,
          socket_id: socket.id,
          user_id: userId
        });
        socket.emit('error_event', { message: 'Failed to send chat message' });
      }
    });

    socket.on('match_update', ({ matchId, score, kills, deaths } = {}) => {
      if (!matchId) return;
      io.to(`match:${matchId}`).emit('match_update', { matchId, score, kills, deaths });
    });

    // User-specific notifications are both persisted and published.
    socket.on('notify_user', async ({ type, content } = {}) => {
      if (!type || !content) return;
      try {
        await db.query(
          `INSERT INTO notifications (user_id, type, content) VALUES ($1, $2, $3)`,
          [userId, type, content]
        );
        await redis.publish(`notify:${userId}`, JSON.stringify({ type, content }));
        io.to(`user:${userId}`).emit('notification', { type, content });
      } catch (e) {
        logError('socket_notify_user_failed', e, {
          connection_id: connectionId,
          socket_id: socket.id,
          user_id: userId
        });
        socket.emit('error_event', { message: 'Failed to publish notification' });
      }
    });

    socket.on('subscribe_notifications', () => {
      socket.join(`user:${userId}`);
    });
  });
}
