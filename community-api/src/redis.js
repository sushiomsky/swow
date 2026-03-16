import { createClient } from 'redis';
import { config } from './config.js';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => {
  console.error('[community-api][redis]', err.message);
});
