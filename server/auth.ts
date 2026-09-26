import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { pool } from './db.js';

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  // 7 days expiration
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO app_sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );

  return token;
}

// In-memory micro-cache for fast session lookups (avoids remote DB roundtrips on rapid requests)
interface CachedSession {
  user: any;
  expiresAt: number;
}
const sessionCache = new Map<string, CachedSession>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds TTL

export function invalidateSessionCache(token?: string) {
  if (token) {
    sessionCache.delete(token);
  } else {
    sessionCache.clear();
  }
}

export async function validateSession(token: string) {
  if (!token) return null;

  const now = Date.now();
  const cached = sessionCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }

  const res = await pool.query(
    `SELECT s.token, s.expires_at, u.id, u.email, u.name, COALESCE(u.role, 'admin') as role 
     FROM app_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );

  if (res.rows.length === 0) {
    sessionCache.delete(token);
    return null;
  }

  const user = res.rows[0];
  sessionCache.set(token, {
    user,
    expiresAt: now + CACHE_TTL_MS,
  });

  return user;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-session-token'] as string);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Session required' });
  }

  const user = await validateSession(token);
  if (!user) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  (req as any).user = user;
  next();
}
