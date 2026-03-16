import 'dotenv/config';

export const config = {
  port: Number(process.env.COMMUNITY_API_PORT || 7000),
  jwtSecret: process.env.COMMUNITY_JWT_SECRET || 'change-me',
  pgUrl: process.env.COMMUNITY_DATABASE_URL || 'postgres://postgres:postgres@postgres:5432/wow_community',
  redisUrl: process.env.COMMUNITY_REDIS_URL || 'redis://redis:6379'
};
