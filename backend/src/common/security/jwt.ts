import crypto from 'crypto';
import { config } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
  username: string;
  sessionId?: string;
  role?: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Signs a short-lived (15 minutes) JWT access token with HMAC-SHA256.
 */
export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>, expiresInSeconds: number = 900): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AccessTokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', config.JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

/**
 * Verifies and decodes an access token. Throws AppError on invalid signature or expiration.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AppError(401, 'INVALID_TOKEN', 'Malformed access token');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', config.JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Token signature verification failed');
  }

  let payload: AccessTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Failed to parse token payload');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new AppError(401, 'TOKEN_EXPIRED', 'Access token has expired');
  }

  return payload;
}

/**
 * Generates a cryptographically secure random opaque token (e.g. for refresh tokens, verification tokens).
 */
export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Produces a SHA-256 hash of an opaque token for secure server-side storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
