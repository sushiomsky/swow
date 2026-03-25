import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { config } from './config.js';
import { db, healthcheckDb } from './db.js';
import { redis } from './redis.js';
import usersRoutes from './routes/users.js';
import authRoutes from './routes/auth.js';
import friendsRoutes from './routes/friends.js';
import leaderboardRoutes from './routes/leaderboards.js';
import clansRoutes from './routes/clans.js';
import challengesRoutes from './routes/challenges.js';
import notificationsRoutes from './routes/notifications.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';
import forumRoutes from './routes/forum.js';
import feedbackRoutes from './routes/feedback.js';
import { attachCommunitySocket } from './socket.js';
import { setRealtimeIO } from './realtime.js';
import { createApiRateLimiter } from './middleware/rateLimit.js';
import { migrateUp } from './migrations.js';
import { logError, logInfo, requestLogger } from './logger.js';
import { startLeaderboardWorker } from './services/leaderboardService.js';

const CORS_ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://localhost:5001', 'https://wizardofwor.duckdns.org'];

// Community API host: profile, ranking, social, moderation and challenge endpoints.
const app = express();
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin || CORS_ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

const authRateLimiter = createApiRateLimiter({
  scope: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 30
});
const chatRateLimiter = createApiRateLimiter({
  scope: 'chat',
  windowMs: 60 * 1000,
  max: 120
});
const forumRateLimiter = createApiRateLimiter({
  scope: 'forum',
  windowMs: 60 * 1000,
  max: 100
});
const adminRateLimiter = createApiRateLimiter({
  scope: 'admin',
  windowMs: 60 * 1000,
  max: 45
});
const feedbackRateLimiter = createApiRateLimiter({
  scope: 'feedback',
  windowMs: 15 * 60 * 1000,
  max: 10
});

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
app.use('/api/community/auth', authRateLimiter, authRoutes);
app.use('/api/community/friends', friendsRoutes);
app.use('/api/community/leaderboards', leaderboardRoutes);
app.use('/api/community/clans', clansRoutes);
app.use('/api/community/challenges', challengesRoutes);
app.use('/api/community/notifications', notificationsRoutes);
app.use('/api/community/chat', chatRateLimiter, chatRoutes);
app.use('/api/community/admin', adminRateLimiter, adminRoutes);
app.use('/api/community/forum', forumRateLimiter, forumRoutes);
app.use('/api/community/feedback', feedbackRateLimiter, feedbackRoutes);

app.use((err, req, res, _next) => {
  logError('http_error', err, {
    request_id: req.requestId || null,
    method: req.method,
    path: req.originalUrl || req.url
  });
  return res.status(500).json({ error: 'Internal server error' });
});

// Socket.IO shares the same HTTP server for chat/notification real-time events.
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CORS_ALLOWED_ORIGINS, credentials: true } });
attachCommunitySocket(io, db, redis);
setRealtimeIO(io);

await redis.connect();
await migrateUp(db);
startLeaderboardWorker();

server.listen(config.port, '0.0.0.0', () => {
  logInfo('community_api_listening', { port: config.port });
});
