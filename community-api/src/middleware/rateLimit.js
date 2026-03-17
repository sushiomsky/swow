import rateLimit from 'express-rate-limit';

function computeRetryAfterSeconds(resetTime) {
  if (!(resetTime instanceof Date)) return undefined;
  const remainingMs = resetTime.getTime() - Date.now();
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

export function createApiRateLimiter({ windowMs, max, scope }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, _next, options) => {
      const retryAfterSeconds = computeRetryAfterSeconds(req.rateLimit?.resetTime);
      return res.status(options.statusCode).json({
        error: 'Rate limit exceeded',
        code: 'rate_limited',
        scope,
        retry_after_seconds: retryAfterSeconds ?? null
      });
    }
  });
}
