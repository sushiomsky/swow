import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const devUserId = req.headers['x-user-id'];
  const devUserRole = req.headers['x-user-role'];

  if (config.allowDevAuth && devUserId) {
    req.user = { sub: devUserId, role: devUserRole || 'user' };
    return next();
  }

  if (!token) {
    if ((devUserId || devUserRole) && !config.allowDevAuth) {
      return res.status(401).json({ error: 'Development auth headers are disabled' });
    }
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
