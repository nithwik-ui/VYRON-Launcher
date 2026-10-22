import { describe, it, expect, afterAll } from 'vitest';
import { prisma, checkDatabaseHealth } from '../src/db/prisma.js';

describe('PostgreSQL Database & Supabase Infrastructure', () => {

  it('should successfully ping database with a harmless query', async () => {
    const isHealthy = await checkDatabaseHealth();
    expect(isHealthy).toBe(true);
  });

  it('should be able to count rows from users table safely', async () => {
    // Basic read verification on the synchronized identity table
    const count = await prisma.user.count();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should support atomic database transactions', async () => {
    const result = await prisma.$transaction(async (tx) => {
      const userCount = await tx.user.count();
      const auditCount = await tx.auditLog.count();
      return { userCount, auditCount };
    });

    expect(typeof result.userCount).toBe('number');
    expect(typeof result.auditCount).toBe('number');
  });

  it('should verify schema table existence in Supabase PostgreSQL', async () => {
    const tables: Array<{ tablename: string }> = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public';
    `;
    const tableNames = tables.map(t => t.tablename);

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('user_sessions');
    expect(tableNames).toContain('oauth_accounts');
    expect(tableNames).toContain('devices');
    expect(tableNames).toContain('email_verification_tokens');
    expect(tableNames).toContain('password_reset_tokens');
    expect(tableNames).toContain('audit_logs');
    expect(tableNames).toContain('_prisma_migrations');
  });
});
