import { createClient } from 'redis';
import { config } from './config.js';
import { logError, logInfo } from './logger.js';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => {
  logError('redis_error', err);
});

redis.on('connect', () => {
  logInfo('redis_connecting');
});

redis.on('ready', () => {
  logInfo('redis_ready');
});
