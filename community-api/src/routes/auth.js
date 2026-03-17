import { Router } from 'express';
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidationError } from '../middleware/validation.js';

const router = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(120),
  display_name: z.string().min(1).max(40).optional(),
  region: z.string().max(20).optional()
});

const loginSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(8).max(120)
});

function deriveHash(password, saltHex) {
  return pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), 210000, 32, 'sha256').toString('hex');
}

function normalizeRole(role) {
  return role === 'admin' ? 'admin' : 'user';
}

function createToken(user) {
  return jwt.sign(
    { sub: user.user_id, role: normalizeRole(user.role), username: user.username },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

router.post('/register', async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body || {});
    const username = payload.username.trim();
    const password = payload.password;

    const { rows: existingRows } = await db.query(
      `SELECT user_id FROM users WHERE username = $1`,
      [username]
    );
    if (existingRows[0]) return res.status(409).json({ error: 'Username already exists' });

    const salt = randomBytes(16).toString('hex');
    const hash = deriveHash(password, salt);

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows: userRows } = await client.query(
        `INSERT INTO users (username, display_name, region, last_active)
         VALUES ($1, $2, $3, NOW())
         RETURNING user_id, username, role, display_name, region, level, xp`,
        [username, payload.display_name || username, payload.region || null]
      );
      await client.query(
        `INSERT INTO auth_credentials (user_id, password_hash, password_salt)
         VALUES ($1, $2, $3)`,
        [userRows[0].user_id, hash, salt]
      );
      await client.query('COMMIT');
      const token = createToken(userRows[0]);
      return res.status(201).json({ token, user: userRows[0] });
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
      `SELECT u.user_id, u.username, u.role, u.display_name, u.region, u.level, u.xp, a.password_hash, a.password_salt
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
      `SELECT user_id, username, role, display_name, avatar_url, bio, level, xp, region
       FROM users WHERE user_id = $1`,
      [req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

export default router;
