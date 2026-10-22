import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db/prisma.js';

describe('Phase 3C.2 — VYRON Identity & Account Services', () => {
  let app: FastifyInstance;
  const testEmail = `test_${Date.now()}@vyronlauncher.com`;
  const testUsername = `user_${Date.now().toString().slice(-8)}`;
  const testPassword = 'StrongPassword123!';
  const testDeviceId = `dev_${Date.now()}`;

  let verificationToken: string;
  let accessToken: string;
  let refreshToken: string;
  let resetToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    // Cleanup test user & sessions
    try {
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      if (user) {
        await prisma.user.delete({ where: { id: user.id } });
      }
      await prisma.device.deleteMany({ where: { deviceFingerprint: testDeviceId } });
    } catch {
      // Ignore cleanup failures
    }
    await app.close();
  });

  // 1. Registration
  it('should successfully register a new user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: testEmail,
        username: testUsername,
        password: testPassword,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.email).toBe(testEmail.toLowerCase());
    expect(body.username).toBe(testUsername);
    expect(body.verificationToken).toBeDefined();

    verificationToken = body.verificationToken;
  });

  // 2. Duplicate Account
  it('should reject registration with duplicate email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: testEmail,
        username: `diff_${Date.now().toString().slice(-6)}`,
        password: testPassword,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('EMAIL_EXISTS');
  });

  it('should reject registration with duplicate username', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `unique_${Date.now()}@vyronlauncher.com`,
        username: testUsername,
        password: testPassword,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('USERNAME_EXISTS');
  });

  // 3. Email Verification
  it('should verify email with valid verification token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        token: verificationToken,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  it('should reject reuse of already-consumed email verification token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        token: verificationToken,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
  });

  // 4. Login
  it('should reject login with invalid password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: 'WrongPassword456!',
        deviceId: testDeviceId,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should successfully log in with valid credentials and register device', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: testPassword,
        deviceId: testDeviceId,
        deviceModel: 'Pixel 8 Pro',
        manufacturer: 'Google',
        androidVersion: 14,
        appVersion: '1.2.0',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.email).toBe(testEmail.toLowerCase());
    expect(body.user.isVerified).toBe(true);

    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
  });

  // 5. User Profile & Devices
  it('should retrieve user profile via /api/v1/me with Bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe(testEmail.toLowerCase());
    expect(body.user.username).toBe(testUsername);
  });

  it('should retrieve registered devices via /api/v1/devices', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/devices',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.devices.length).toBeGreaterThanOrEqual(1);
    expect(body.devices.some((d: any) => d.deviceFingerprint === testDeviceId)).toBe(true);
  });

  // 6. Refresh Token Rotation
  it('should refresh access token and rotate refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: {
        refreshToken,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.refreshToken).not.toBe(refreshToken); // Rotated!

    // Save previous token for replay attack test, update active tokens
    const oldRefreshToken = refreshToken;
    refreshToken = body.refreshToken;
    accessToken = body.accessToken;

    // 7. Replay Attack Detection
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: {
        refreshToken: oldRefreshToken, // Reusing old token!
      },
    });

    expect(replayRes.statusCode).toBe(401);
    const replayBody = replayRes.json();
    expect(replayBody.error.code).toBe('TOKEN_REPLAY_DETECTED');
  });

  // 8. Password Reset Flow (Anti-Enumeration)
  it('should return 200 for forgot password without revealing if email exists', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: {
        email: testEmail,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.resetToken).toBeDefined();

    resetToken = body.resetToken;

    // Non-existent email returns exact same success format
    const nonExistentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: {
        email: 'does_not_exist@vyronlauncher.com',
      },
    });

    expect(nonExistentRes.statusCode).toBe(200);
    expect(nonExistentRes.json().success).toBe(true);
  });

  it('should reset password with valid reset token and allow login with new password', async () => {
    const newPassword = 'NewStrongPassword456!';

    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token: resetToken,
        newPassword,
      },
    });

    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.json().success).toBe(true);

    // Old password should now fail
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: testPassword,
        deviceId: testDeviceId,
      },
    });
    expect(oldLogin.statusCode).toBe(401);

    // New password should succeed
    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: newPassword,
        deviceId: testDeviceId,
      },
    });
    expect(newLogin.statusCode).toBe(200);
    refreshToken = newLogin.json().refreshToken;
    accessToken = newLogin.json().accessToken;
  });

  // 9. Logout & Session Revocation
  it('should successfully log out active session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: {
        refreshToken,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    // Refreshing with logged out token should fail
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: {
        refreshToken,
      },
    });
    expect(refreshRes.statusCode).toBe(401);
  });
});
