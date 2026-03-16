import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { config } from './config.js';
import { db, healthcheckDb } from './db.js';
import { redis } from './redis.js';
import usersRoutes from './routes/users.js';
import friendsRoutes from './routes/friends.js';
import leaderboardRoutes from './routes/leaderboards.js';
import clansRoutes from './routes/clans.js';
import challengesRoutes from './routes/challenges.js';
import notificationsRoutes from './routes/notifications.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';
import { attachCommunitySocket } from './socket.js';
import { setRealtimeIO } from './realtime.js';

// Community API host: profile, ranking, social, moderation and challenge endpoints.
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try {
    const dbOk = await healthcheckDb();
    const redisOk = redis.isOpen;
    return res.json({ ok: dbOk && redisOk, db: dbOk, redis: redisOk });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
});

app.use('/api/community/users', usersRoutes);
app.use('/api/community/friends', friendsRoutes);
app.use('/api/community/leaderboards', leaderboardRoutes);
app.use('/api/community/clans', clansRoutes);
app.use('/api/community/challenges', challengesRoutes);
app.use('/api/community/notifications', notificationsRoutes);
app.use('/api/community/chat', chatRoutes);
app.use('/api/community/admin', adminRoutes);

app.use((err, _req, res, _next) => {
  console.error('[community-api]', err);
  return res.status(500).json({ error: 'Internal server error' });
});

// Socket.IO shares the same HTTP server for chat/notification real-time events.
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
attachCommunitySocket(io, db, redis);
setRealtimeIO(io);

await redis.connect();

server.listen(config.port, '0.0.0.0', () => {
  console.log(`Community API listening on ${config.port}`);
});
