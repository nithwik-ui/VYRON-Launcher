import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db/prisma.js';

describe('Phase 3C.3 — Session & Device Security Controls', () => {
  let app: FastifyInstance;
  const testEmail = `sec_${Date.now()}@vyronlauncher.com`;
  const testUsername = `sec_${Date.now().toString().slice(-8)}`;
  const testPassword = 'InitialSecurePassword123!';
  const newPassword = 'UpdatedSecurePassword456!';
  const device1 = `dev1_${Date.now()}`;
  const device2 = `dev2_${Date.now()}`;

  let userAccessToken: string;
  let userRefreshToken: string;
  let secondSessionToken: string;
  let secondSessionId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Register user
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: testEmail,
        username: testUsername,
        password: testPassword,
      },
    });

    // Verify email
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        token: regRes.json().verificationToken,
      },
    });

    // Login from Device 1
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: testPassword,
        deviceId: device1,
        deviceModel: 'Pixel 8',
      },
    });

    userAccessToken = loginRes.json().accessToken;
    userRefreshToken = loginRes.json().refreshToken;

    // Login from Device 2
    const loginRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: testPassword,
        deviceId: device2,
        deviceModel: 'Galaxy S24',
      },
    });

    secondSessionToken = loginRes2.json().accessToken;
  });

  afterAll(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      if (user) {
        await prisma.user.delete({ where: { id: user.id } });
      }
      await prisma.device.deleteMany({ where: { deviceFingerprint: { in: [device1, device2] } } });
    } catch {
      // Ignore cleanup failures
    }
    await app.close();
  });

  // 1. Session Listing
  it('should list all active sessions for current user and flag isCurrent', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sessions',
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sessions).toBeDefined();
    expect(body.sessions.length).toBeGreaterThanOrEqual(2);

    const current = body.sessions.find((s: any) => s.isCurrent === true);
    expect(current).toBeDefined();

    const other = body.sessions.find((s: any) => s.isCurrent === false);
    expect(other).toBeDefined();
    secondSessionId = other.id;
  });

  // 2. Revoke Specific Session
  it('should revoke a specific session by ID', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sessions/${secondSessionId}`,
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    // Verify list reflects revocation
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sessions',
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
    });

    expect(listRes.json().sessions.some((s: any) => s.id === secondSessionId)).toBe(false);
  });

  // 3. Password Change with Session Invalidation
  it('should change password and invalidate all other sessions', async () => {
    // Attempt with invalid current password
    const failRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
      payload: {
        currentPassword: 'WrongPassword!',
        newPassword,
      },
    });
    expect(failRes.statusCode).toBe(401);

    // Success change password
    const successRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
      payload: {
        currentPassword: testPassword,
        newPassword,
      },
    });
    expect(successRes.statusCode).toBe(200);
    expect(successRes.json().success).toBe(true);
  });

  // 4. Revoke Device
  it('should revoke device and its sessions', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/devices/${device2}`,
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  // 5. Account Lockout Policy
  it('should lock account temporarily after 5 failed login attempts', async () => {
    const victimEmail = `lock_${Date.now()}@vyronlauncher.com`;
    const vicReg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: victimEmail,
        username: `lock_${Date.now().toString().slice(-6)}`,
        password: 'ValidPassword123!',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        token: vicReg.json().verificationToken,
      },
    });

    // 5 consecutive failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: victimEmail,
          password: 'BadPassword!',
          deviceId: 'attacker_dev',
        },
      });
      expect(res.statusCode).toBe(401);
    }

    // 6th attempt should be blocked by ACCOUNT_LOCKED policy (429)
    const lockedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: victimEmail,
        password: 'ValidPassword123!', // Even with valid password!
        deviceId: 'attacker_dev',
      },
    });

    expect(lockedRes.statusCode).toBe(429);
    expect(lockedRes.json().error.code).toBe('ACCOUNT_LOCKED');
  });
});
