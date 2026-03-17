import { randomUUID } from 'node:crypto';

function sanitizeContext(context = {}) {
  const output = {};
  for (const [key, value] of Object.entries(context)) {
    output[key] = value === undefined ? null : value;
  }
  return output;
}

function write(level, event, context = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...sanitizeContext(context)
  };
  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
  } else {
    console.log(serialized);
  }
}

export function createRequestId() {
  return randomUUID();
}

export function logInfo(event, context = {}) {
  write('info', event, context);
}

export function logWarn(event, context = {}) {
  write('warn', event, context);
}

export function logError(event, error, context = {}) {
  const errorContext = {
    error_name: error?.name || 'Error',
    error_message: error?.message || String(error),
    error_stack: error?.stack || null
  };
  write('error', event, { ...context, ...errorContext });
}

function normalizeRequestId(headerValue) {
  if (typeof headerValue !== 'string') return createRequestId();
  const trimmed = headerValue.trim();
  if (!trimmed) return createRequestId();
  return trimmed.slice(0, 128);
}

export function requestLogger(req, res, next) {
  const requestId = normalizeRequestId(req.headers['x-request-id']);
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logInfo('http_request', {
      request_id: requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status_code: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
      user_id: req.user?.sub || null
    });
  });

  next();
}
