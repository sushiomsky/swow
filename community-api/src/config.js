import 'dotenv/config';

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.COMMUNITY_API_PORT || 7000),
  jwtSecret: (() => {
    // Hardening: ohne echtes Secret gar nicht erst starten — 'change-me'
    // machte alle JWTs fälschbar. Tests setzen COMMUNITY_JWT_SECRET=test-secret.
    const secret = process.env.COMMUNITY_JWT_SECRET;
    if (!secret || secret === 'change-me') {
      throw new Error('COMMUNITY_JWT_SECRET must be set to a strong random value');
    }
    return secret;
  })(),
  pgUrl: process.env.COMMUNITY_DATABASE_URL || 'postgres://postgres:postgres@postgres:5432/wow_community',
  redisUrl: process.env.COMMUNITY_REDIS_URL || 'redis://redis:6379',
  allowDevAuth: !isProduction && parseBooleanEnv(process.env.COMMUNITY_ALLOW_DEV_AUTH, false),
  exposeAuthFlowTokens: !isProduction && parseBooleanEnv(process.env.COMMUNITY_EXPOSE_AUTH_FLOW_TOKENS, true),
  githubToken: process.env.GITHUB_FEEDBACK_TOKEN || '',
  githubRepo: process.env.GITHUB_FEEDBACK_REPO || 'sushiomsky/swow',
};
