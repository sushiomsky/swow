import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
