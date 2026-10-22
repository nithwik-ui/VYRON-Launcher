import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/common/security/password.js';
import { AppError } from '../src/common/errors/app-error.js';

describe('Security Controls & Argon2id Password Hashing', () => {
  it('should hash a valid password using Argon2id and verify correctly', async () => {
    const password = 'SuperSecretVyronPassword123!';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain('m=65536,t=3,p=2'); // Exact approved Phase 3A parameters

    const isMatch = await verifyPassword(hash, password);
    expect(isMatch).toBe(true);
  });

  it('should reject incorrect password attempts', async () => {
    const password = 'CorrectPassword123!';
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(hash, 'WrongPassword123!');
    expect(isMatch).toBe(false);
  });

  it('should reject passwords shorter than 8 characters', async () => {
    await expect(hashPassword('short')).rejects.toThrow('Password must be at least 8 characters');
  });

  it('should construct standardized AppError instances', () => {
    const error = AppError.badRequest('Invalid payload', 'INVALID_PAYLOAD', { field: 'email' });
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('INVALID_PAYLOAD');
    expect(error.message).toBe('Invalid payload');
    expect(error.details).toEqual({ field: 'email' });
  });
});
