import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { disconnectDatabase, prisma } from '../src/db/prisma.js';
import { redisService } from '../src/redis/client.js';
import { hashPassword } from '../src/common/security/password.js';
import { generateTotpCode } from '../src/common/security/totp.js';

describe('Phase 3E — VYRON Control Center & RBAC with TOTP MFA', () => {
  let app: FastifyInstance;
  const timestamp = Date.now();

  const superAdminEmail = `superadmin_${timestamp}@vyronlauncher.com`;
  const contentAdminEmail = `contentadmin_${timestamp}@vyronlauncher.com`;
  const standardUserEmail = `player_${timestamp}@example.com`;
  const plainPassword = 'AdminPassword123!';

  let superAdminId: string;
  let contentAdminId: string;
  let standardUserId: string;

  let superAdminToken: string;
  let contentAdminToken: string;
  let totpSecret: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    const passwordHash = await hashPassword(plainPassword);

    // Create Super Admin user
    const superAdmin = await prisma.user.create({
      data: {
        username: `super_${timestamp}`,
        email: superAdminEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        isVerified: true,
      },
    });
    superAdminId = superAdmin.id;

    // Create Content Admin user
    const contentAdmin = await prisma.user.create({
      data: {
        username: `content_${timestamp}`,
        email: contentAdminEmail,
        passwordHash,
        role: 'CONTENT_ADMIN',
        isVerified: true,
      },
    });
    contentAdminId = contentAdmin.id;

    // Create Standard Player user
    const standardUser = await prisma.user.create({
      data: {
        username: `player_${timestamp}`,
        email: standardUserEmail,
        passwordHash,
        role: 'USER',
        isVerified: true,
      },
    });
    standardUserId = standardUser.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { userId: { in: [superAdminId, contentAdminId, standardUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [superAdminId, contentAdminId, standardUserId] } },
    });

    await app.close();
    await disconnectDatabase();
    await redisService.disconnect();
  });

  it('POST /api/v1/admin/auth/login should reject standard USER accounts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: {
        email: standardUserEmail,
        password: plainPassword,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('UNAUTHORIZED_ACCESS');
  });

  it('POST /api/v1/admin/auth/login should allow staff login and return permissions bitmask', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: {
        email: superAdminEmail,
        password: plainPassword,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.user.role).toBe('SUPER_ADMIN');
    expect(body.data.user.permissions).toContain('*');

    superAdminToken = body.data.token;
  });

  it('POST /api/v1/admin/totp/setup and /verify should configure RFC 6238 two-factor authentication', async () => {
    // 1. Initiate TOTP setup
    const setupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/totp/setup',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    expect(setupRes.statusCode).toBe(200);
    const setupBody = JSON.parse(setupRes.payload);
    expect(setupBody.success).toBe(true);
    expect(setupBody.data.secret).toBeDefined();
    expect(setupBody.data.uri).toContain('otpauth://totp/VYRON');

    totpSecret = setupBody.data.secret;

    // 2. Compute 6-digit TOTP code and confirm verification
    const validCode = generateTotpCode(totpSecret);
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/totp/verify',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      payload: { totpCode: validCode },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyRes.payload);
    expect(verifyBody.success).toBe(true);

    // Verify DB flag updated
    const updatedUser = await prisma.user.findUnique({ where: { id: superAdminId } });
    expect(updatedUser?.isTotpEnabled).toBe(true);
  });

  it('POST /api/v1/admin/auth/login should enforce TOTP code once MFA is activated', async () => {
    // 1. Attempt login without TOTP code
    const missingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: {
        email: superAdminEmail,
        password: plainPassword,
      },
    });
    expect(missingRes.statusCode).toBe(400);
    expect(JSON.parse(missingRes.payload).error.code).toBe('MFA_REQUIRED');

    // 2. Attempt login with invalid TOTP code
    const invalidRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: {
        email: superAdminEmail,
        password: plainPassword,
        totpCode: '000000',
      },
    });
    expect(invalidRes.statusCode).toBe(401);
    expect(JSON.parse(invalidRes.payload).error.code).toBe('INVALID_MFA_CODE');

    // 3. Attempt login with valid TOTP code
    const validCode = generateTotpCode(totpSecret);
    const validRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: {
        email: superAdminEmail,
        password: plainPassword,
        totpCode: validCode,
      },
    });
    expect(validRes.statusCode).toBe(200);
    const validBody = JSON.parse(validRes.payload);
    expect(validBody.success).toBe(true);
    expect(validBody.data.token).toBeDefined();
    superAdminToken = validBody.data.token;
  });

  it('RBAC permission guards should prevent CONTENT_ADMIN from executing SUPER_ADMIN operations', async () => {
    // Login as CONTENT_ADMIN
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: {
        email: contentAdminEmail,
        password: plainPassword,
      },
    });
    expect(loginRes.statusCode).toBe(200);
    contentAdminToken = JSON.parse(loginRes.payload).data.token;

    // CONTENT_ADMIN attempts to change a user's role (Restricted to SUPER_ADMIN)
    const roleChangeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${standardUserId}/role`,
      headers: { Authorization: `Bearer ${contentAdminToken}` },
      payload: { role: 'MODERATOR' },
    });

    expect(roleChangeRes.statusCode).toBe(403);
    const roleChangeBody = JSON.parse(roleChangeRes.payload);
    expect(roleChangeBody.error.code).toBe('ROLE_NOT_AUTHORIZED');

    // SUPER_ADMIN successfully performs the role assignment
    const superRoleRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${standardUserId}/role`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
      payload: { role: 'MODERATOR' },
    });

    expect(superRoleRes.statusCode).toBe(200);
    const superRoleBody = JSON.parse(superRoleRes.payload);
    expect(superRoleBody.data.role).toBe('MODERATOR');
  });

  it('GET /api/v1/admin/audit-logs should record immutable administrative actions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-logs?limit=10',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    // Verify presence of staff actions
    const actions = body.data.map((log: any) => log.action);
    expect(actions).toContain('STAFF_ROLE_ASSIGNED');
  });

  it('GET /api/v1/admin should serve the unified VYRON Control Center web application', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.payload).toContain('VYRON Control Center');
    expect(res.payload).toContain('CONTROL CENTER');
  });
});

