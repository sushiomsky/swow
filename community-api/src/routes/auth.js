import { Router } from 'express';
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidationError } from '../middleware/validation.js';
import { logInfo } from '../logger.js';

const router = Router();

const EMAIL_VERIFY_PURPOSE = 'email_verify';
const PASSWORD_RESET_PURPOSE = 'password_reset';
const EMAIL_VERIFY_TTL_MINUTES = 24 * 60;
const PASSWORD_RESET_TTL_MINUTES = 60;

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(120),
  email: z.string().email().max(254),
  display_name: z.string().min(1).max(40).optional(),
  region: z.string().max(20).optional()
});

const loginSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(8).max(120)
});

const emailSchema = z.object({
  email: z.string().email().max(254)
});

const tokenSchema = z.object({
  token: z.string().min(32).max(256)
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(8).max(120)
});

function deriveHash(password, saltHex) {
  return pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), 210000, 32, 'sha256').toString('hex');
}

function hashActionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeRole(role) {
  return role === 'admin' ? 'admin' : 'user';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function createToken(user) {
  return jwt.sign(
    { sub: user.user_id, role: normalizeRole(user.role), username: user.username },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

async function issueAuthActionToken(client, { userId, purpose, ttlMinutes }) {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashActionToken(rawToken);

  await client.query(
    `UPDATE auth_action_tokens
     SET consumed_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [userId, purpose]
  );

  await client.query(
    `INSERT INTO auth_action_tokens (user_id, purpose, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + make_interval(mins => $4::int))`,
    [userId, purpose, tokenHash, ttlMinutes]
  );

  return rawToken;
}

async function consumeAuthActionToken(client, { token, purpose }) {
  const tokenHash = hashActionToken(token);
  const { rows } = await client.query(
    `UPDATE auth_action_tokens
     SET consumed_at = NOW()
     WHERE token_hash = $1
       AND purpose = $2
       AND consumed_at IS NULL
       AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash, purpose]
  );
  return rows[0]?.user_id || null;
}

function maybeIncludeDevToken(responseBody, key, token) {
  if (config.exposeAuthFlowTokens && token) {
    return { ...responseBody, [key]: token };
  }
  return responseBody;
}

router.post('/register', async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body || {});
    const username = payload.username.trim();
    const password = payload.password;
    const email = normalizeEmail(payload.email);

    const { rows: existingRows } = await db.query(
      `SELECT user_id, username, email
       FROM users
       WHERE username = $1 OR LOWER(email) = $2`,
      [username, email]
    );
    if (existingRows[0]?.username === username) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    if (existingRows[0]?.email && normalizeEmail(existingRows[0].email) === email) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const salt = randomBytes(16).toString('hex');
    const hash = deriveHash(password, salt);

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows: userRows } = await client.query(
        `INSERT INTO users (username, email, display_name, region, last_active)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING user_id, username, role, email, display_name, region, level, xp, (email_verified_at IS NOT NULL) AS email_verified`,
        [username, email, payload.display_name || username, payload.region || null]
      );
      await client.query(
        `INSERT INTO auth_credentials (user_id, password_hash, password_salt)
         VALUES ($1, $2, $3)`,
        [userRows[0].user_id, hash, salt]
      );
      const verificationToken = await issueAuthActionToken(client, {
        userId: userRows[0].user_id,
        purpose: EMAIL_VERIFY_PURPOSE,
        ttlMinutes: EMAIL_VERIFY_TTL_MINUTES
      });
      await client.query('COMMIT');

      logInfo('auth_action_token_issued', {
        purpose: EMAIL_VERIFY_PURPOSE,
        user_id: userRows[0].user_id
      });

      const token = createToken(userRows[0]);
      const responseBody = maybeIncludeDevToken({
        token,
        user: userRows[0],
        verification_required: true
      }, 'email_verification_token', verificationToken);
      return res.status(201).json(responseBody);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body || {});
    const username = payload.username.trim();
    const { rows } = await db.query(
      `SELECT u.user_id, u.username, u.role, u.display_name, u.region, u.level, u.xp, u.email,
              (u.email_verified_at IS NOT NULL) AS email_verified,
              a.password_hash, a.password_salt
       FROM users u
       JOIN auth_credentials a ON a.user_id = u.user_id
       WHERE u.username = $1`,
      [username]
    );
    const row = rows[0];
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });

    const computedHash = deriveHash(payload.password, row.password_salt);
    const stored = Buffer.from(row.password_hash, 'hex');
    const computed = Buffer.from(computedHash, 'hex');
    if (stored.length !== computed.length || !timingSafeEqual(stored, computed)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await db.query(`UPDATE users SET last_active = NOW() WHERE user_id = $1`, [row.user_id]);
    const user = {
      user_id: row.user_id,
      username: row.username,
      role: normalizeRole(row.role),
      display_name: row.display_name,
      region: row.region,
      email: row.email,
      email_verified: Boolean(row.email_verified),
      level: row.level,
      xp: row.xp
    };
    const token = createToken(user);
    return res.json({ token, user });
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT user_id, username, role, display_name, avatar_url, bio, level, xp, region, email,
              (email_verified_at IS NOT NULL) AS email_verified
       FROM users WHERE user_id = $1`,
      [req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.post('/verify-email/request', async (req, res, next) => {
  try {
    const { email } = emailSchema.parse(req.body || {});
    const normalizedEmail = normalizeEmail(email);
    const { rows } = await db.query(
      `SELECT user_id, email_verified_at
       FROM users
       WHERE LOWER(email) = $1`,
      [normalizedEmail]
    );

    let verificationToken = null;
    if (rows[0] && !rows[0].email_verified_at) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        verificationToken = await issueAuthActionToken(client, {
          userId: rows[0].user_id,
          purpose: EMAIL_VERIFY_PURPOSE,
          ttlMinutes: EMAIL_VERIFY_TTL_MINUTES
        });
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      logInfo('auth_action_token_issued', {
        purpose: EMAIL_VERIFY_PURPOSE,
        user_id: rows[0].user_id
      });
    }

    const responseBody = maybeIncludeDevToken({
      ok: true,
      message: 'If an account exists, a verification email has been sent.'
    }, 'email_verification_token', verificationToken);
    return res.json(responseBody);
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/verify-email/confirm', async (req, res, next) => {
  try {
    const { token } = tokenSchema.parse(req.body || {});
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const userId = await consumeAuthActionToken(client, {
        token,
        purpose: EMAIL_VERIFY_PURPOSE
      });
      if (!userId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid or expired token' });
      }
      await client.query(
        `UPDATE users
         SET email_verified_at = COALESCE(email_verified_at, NOW())
         WHERE user_id = $1`,
        [userId]
      );
      await client.query('COMMIT');
      return res.json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/password-reset/request', async (req, res, next) => {
  try {
    const { email } = emailSchema.parse(req.body || {});
    const normalizedEmail = normalizeEmail(email);
    const { rows } = await db.query(
      `SELECT user_id FROM users WHERE LOWER(email) = $1`,
      [normalizedEmail]
    );

    let resetToken = null;
    if (rows[0]) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        resetToken = await issueAuthActionToken(client, {
          userId: rows[0].user_id,
          purpose: PASSWORD_RESET_PURPOSE,
          ttlMinutes: PASSWORD_RESET_TTL_MINUTES
        });
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      logInfo('auth_action_token_issued', {
        purpose: PASSWORD_RESET_PURPOSE,
        user_id: rows[0].user_id
      });
    }

    const responseBody = maybeIncludeDevToken({
      ok: true,
      message: 'If an account exists, a password reset email has been sent.'
    }, 'password_reset_token', resetToken);
    return res.json(responseBody);
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

router.post('/password-reset/confirm', async (req, res, next) => {
  try {
    const { token, password } = passwordResetConfirmSchema.parse(req.body || {});
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const userId = await consumeAuthActionToken(client, {
        token,
        purpose: PASSWORD_RESET_PURPOSE
      });
      if (!userId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid or expired token' });
      }
      const salt = randomBytes(16).toString('hex');
      const hash = deriveHash(password, salt);
      await client.query(
        `UPDATE auth_credentials
         SET password_hash = $2, password_salt = $3
         WHERE user_id = $1`,
        [userId, hash, salt]
      );
      await client.query('COMMIT');
      return res.json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    if (handleValidationError(res, e)) return;
    return next(e);
  }
});

export default router;
