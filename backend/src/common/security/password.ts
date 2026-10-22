import argon2 from 'argon2';
import crypto from 'crypto';

/**
 * Approved Argon2id hashing parameters:
 * Memory: 64 MB (65536 KB)
 * Iterations: 3
 * Parallelism: 2
 * Salt: 16 cryptographically random bytes (128 bits minimum)
 */
const ARGON2ID_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 2,
};

/**
 * Hashes a plaintext password using Argon2id with production-approved security parameters.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters in length');
  }
  const salt = crypto.randomBytes(16);
  return await argon2.hash(password, { ...ARGON2ID_OPTIONS, salt });
}

/**
 * Verifies a password attempt against a stored Argon2id hash.
 * Constant-time comparison handled internally by libargon2.
 */
export async function verifyPassword(hash: string, passwordAttempt: string): Promise<boolean> {
  if (!hash || !passwordAttempt) {
    return false;
  }
  try {
    return await argon2.verify(hash, passwordAttempt);
  } catch {
    return false;
  }
}
