import 'dotenv/config';

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.COMMUNITY_API_PORT || 7000),
  jwtSecret: process.env.COMMUNITY_JWT_SECRET || 'change-me',
  pgUrl: process.env.COMMUNITY_DATABASE_URL || 'postgres://postgres:postgres@postgres:5432/wow_community',
  redisUrl: process.env.COMMUNITY_REDIS_URL || 'redis://redis:6379',
  allowDevAuth: !isProduction && parseBooleanEnv(process.env.COMMUNITY_ALLOW_DEV_AUTH, false),
  exposeAuthFlowTokens: !isProduction && parseBooleanEnv(process.env.COMMUNITY_EXPOSE_AUTH_FLOW_TOKENS, true)
};
