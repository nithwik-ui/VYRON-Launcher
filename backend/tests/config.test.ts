import { describe, it, expect } from 'vitest';
import { getSanitizedConfig } from '../src/config/env.js';

describe('Configuration & Security Validation', () => {
  it('should sanitize all sensitive secrets from configuration exports', () => {
    const sanitized = getSanitizedConfig();

    expect(sanitized.DATABASE_URL).toBe('[REDACTED]');
    expect(sanitized.DIRECT_URL).toBe('[REDACTED]');
    expect(sanitized.SUPABASE_SECRET_KEY).toBe('[REDACTED]');
    expect(sanitized.SUPABASE_SERVICE_ROLE_KEY).toBe('[REDACTED]');
    expect(sanitized.JWT_SECRET).toBe('[REDACTED]');

    // Non-sensitive configuration must remain readable
    expect(sanitized.APP_ENV).toBeDefined();
    expect(sanitized.PORT).toBeDefined();
    expect(sanitized.SUPABASE_URL).toBeDefined();
  });

  it('should reject insecure SSL bypass options in production configuration', async () => {
    const { validateConfig } = await import('../src/config/env.js');

    expect(() => {
      validateConfig({
        APP_ENV: 'production',
        PORT: '3000',
        HOST: '0.0.0.0',
        DATABASE_URL: 'postgresql://postgres:secret@db.zwigqoqqnqmgdnafjkor.supabase.co:5432/postgres?sslmode=require&sslaccept=accept_invalid_certs',
        SUPABASE_URL: 'https://zwigqoqqnqmgdnafjkor.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_valid_prod_key_123',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid',
        JWT_SECRET: 'production_super_secret_jwt_key_32bytes',
        REDIS_URL: 'redis://redis.production.internal:6379',
      });
    }).toThrow(/PRODUCTION SECURITY VIOLATION/);
  });

  it('should require valid Supabase keys in production configuration', async () => {
    const { validateConfig } = await import('../src/config/env.js');

    expect(() => {
      validateConfig({
        APP_ENV: 'production',
        PORT: '3000',
        HOST: '0.0.0.0',
        DATABASE_URL: 'postgresql://postgres:secret@db.zwigqoqqnqmgdnafjkor.supabase.co:5432/postgres?sslmode=require',
        SUPABASE_URL: 'https://zwigqoqqnqmgdnafjkor.supabase.co',
        SUPABASE_SECRET_KEY: 'placeholder',
        SUPABASE_SERVICE_ROLE_KEY: '',
        JWT_SECRET: 'production_super_secret_jwt_key_32bytes',
        REDIS_URL: 'redis://redis.production.internal:6379',
      });
    }).toThrow(/SUPABASE_SECRET_KEY must be configured/);
  });

  it('should accept valid production configuration with verified SSL', async () => {
    const { validateConfig } = await import('../src/config/env.js');

    const validProd = validateConfig({
      APP_ENV: 'production',
      PORT: '3000',
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgresql://postgres:secret@db.zwigqoqqnqmgdnafjkor.supabase.co:5432/postgres?sslmode=require',
      SUPABASE_URL: 'https://zwigqoqqnqmgdnafjkor.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_real_production_secret',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real_service_role',
      JWT_SECRET: 'production_super_secret_jwt_key_32bytes',
      REDIS_URL: 'redis://redis.production.internal:6379',
    });

    expect(validProd.APP_ENV).toBe('production');
    expect(validProd.DATABASE_URL).toContain('sslmode=require');
  });
});
