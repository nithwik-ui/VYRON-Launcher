import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db/prisma.js';

describe('Phase 4.0.2 — VYRON Identity, Email OTP & Multiplayer Authentication', () => {
  let app: FastifyInstance;
  const testEmail = `otp_user_${Date.now()}@vyronlauncher.com`;
  const testUsername = `VyronPilot_${Date.now().toString().slice(-6)}`;
  const testPassword = 'SecurePassword2026!';
  const testDeviceId = `device_otp_${Date.now()}`;

  let rawOtp: string;
  let userAccessToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      if (user) {
        await prisma.user.delete({ where: { id: user.id } });
      }
      await prisma.device.deleteMany({ where: { deviceFingerprint: testDeviceId } });
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  // 1. Reserved Username
  it('should reject registration with reserved username', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `admin_${Date.now()}@vyronlauncher.com`,
        username: 'admin',
        password: testPassword,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('RESERVED_USERNAME');
  });

  // 2. Successful Registration with 6-digit OTP
  it('should register a new user and generate a 6-digit numeric verification OTP', async () => {
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
    expect(body.otp).toBeDefined();
    expect(body.otp).toMatch(/^\d{6}$/);

    rawOtp = body.otp;
  });

  // 3. Case-Insensitive Duplicate Username Check
  it('should reject duplicate username differing only by letter case', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `diff_case_${Date.now()}@vyronlauncher.com`,
        username: testUsername.toLowerCase(),
        password: testPassword,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('USERNAME_EXISTS');
  });

  // 4. Login Attempt Before Email Verification
  it('should reject login before email OTP verification', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: testUsername,
        password: testPassword,
        deviceId: testDeviceId,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  // 5. Invalid OTP Rejection
  it('should reject invalid 6-digit verification code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        email: testEmail,
        otp: '000000',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
  });

  // 6. Resend OTP with Rate Limiting Cooldown
  it('should resend a new OTP and enforce 60-second cooldown', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-otp',
      payload: { email: testEmail },
    });

    expect(res1.statusCode).toBe(200);
    const body1 = res1.json();
    expect(body1.success).toBe(true);
    expect(body1.otp).toBeDefined();
    expect(body1.otp).toMatch(/^\d{6}$/);

    // Update rawOtp to the newly issued one
    rawOtp = body1.otp;

    // Immediate second resend must hit 429 rate limit
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-otp',
      payload: { email: testEmail },
    });

    expect(res2.statusCode).toBe(429);
    const body2 = res2.json();
    expect(body2.error.code).toBe('RATE_LIMITED');
  });

  // 7. Successful OTP Verification
  it('should successfully verify email with the resent 6-digit OTP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        email: testEmail,
        otp: rawOtp,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  // 8. Login With Username (Identifier)
  it('should allow login with VYRON username identifier', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: testUsername,
        password: testPassword,
        deviceId: testDeviceId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.user.username).toBe(testUsername);
    expect(body.user.isVerified).toBe(true);

    userAccessToken = body.accessToken;
  });

  // 9. Login With Email (Identifier)
  it('should allow login with email identifier', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: testEmail,
        password: testPassword,
        deviceId: testDeviceId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.user.email).toBe(testEmail.toLowerCase());
  });

  // 10. VYRON Multiplayer Server Credential Generation
  it('should issue a short-lived VYRON multiplayer server credential', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/server-credential',
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
      payload: {
        serverAddress: 'play.vyroncraft.net:25565',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.serverCredential).toBeDefined();
    expect(body.serverCredential).toMatch(/^vsc_[a-f0-9]{64}$/);
    expect(body.expiresIn).toBe(300);
    expect(body.serverAddress).toBe('play.vyroncraft.net:25565');

    const ticket = body.serverCredential;

    // 11. Verify Server Credential (Server-side validation)
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-server-credential',
      payload: {
        serverAddress: 'play.vyroncraft.net:25565',
        serverCredential: ticket,
        username: testUsername,
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = verifyRes.json();
    expect(verifyBody.valid).toBe(true);
    expect(verifyBody.user.username).toBe(testUsername);

    // 12. Single-use enforcement: re-verification must fail
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-server-credential',
      payload: {
        serverAddress: 'play.vyroncraft.net:25565',
        serverCredential: ticket,
        username: testUsername,
      },
    });

    expect(replayRes.statusCode).toBe(401);
    const replayBody = replayRes.json();
    expect(replayBody.error.code).toBe('INVALID_SERVER_CREDENTIAL');
  });

  // 13. Mismatched Server Address Rejection
  it('should reject server credential verification if server address does not match', async () => {
    // Generate new credential
    const genRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/server-credential',
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
      payload: {
        serverAddress: 'official.vyron.gg',
      },
    });

    const ticket = genRes.json().serverCredential;

    // Attempt verify with different server
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-server-credential',
      payload: {
        serverAddress: 'evil-proxy.org',
        serverCredential: ticket,
        username: testUsername,
      },
    });

    expect(verifyRes.statusCode).toBe(403);
    const body = verifyRes.json();
    expect(body.error.code).toBe('CREDENTIAL_MISMATCH');
  });
});
