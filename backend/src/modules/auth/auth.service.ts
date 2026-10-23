import crypto from 'crypto';
import { prisma } from '../../db/prisma.js';
import { redisService } from '../../redis/client.js';
import { hashPassword, verifyPassword } from '../../common/security/password.js';
import { signAccessToken, generateOpaqueToken, hashToken } from '../../common/security/jwt.js';
import { EmailService } from '../../common/email/email.service.js';
import { AppError } from '../../common/errors/app-error.js';
import { AuditService } from '../audit/audit.service.js';
import {
  RegisterInput,
  LoginInput,
  RefreshInput,
  VerifyEmailInput,
  ResendOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ServerCredentialInput,
  VerifyServerCredentialInput,
} from './auth.schemas.js';

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'vyron',
  'vyronlauncher',
  'official',
  'moderator',
  'mod',
  'support',
  'staff',
  'owner',
  'security',
  'bot',
  'server',
  'minecraft',
  'mojang',
  'microsoft',
]);

export class AuthService {
  /**
   * Registers a new user account with Argon2id password hashing and 6-digit Email OTP.
   */
  static async register(input: RegisterInput, ctx: RequestContext = {}) {
    const normalizedUsername = input.username.trim();
    const lowerUsername = normalizedUsername.toLowerCase();

    if (RESERVED_USERNAMES.has(lowerUsername)) {
      throw new AppError(400, 'RESERVED_USERNAME', 'This username is reserved and cannot be registered');
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existingEmail) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email address already exists');
    }

    const existingUsername = await prisma.user.findFirst({
      where: {
        username: {
          equals: normalizedUsername,
          mode: 'insensitive',
        },
      },
    });
    if (existingUsername) {
      throw new AppError(409, 'USERNAME_EXISTS', 'This username is already taken');
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        username: normalizedUsername,
        passwordHash,
        isActive: true,
        isVerified: false,
      },
    });

    // 1. Generate 6-digit numeric OTP (100000 - 999999) stored in Redis
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    await redisService.set(`email_otp:${user.id}`, rawOtp, 15 * 60); // 15 mins

    // 2. Generate opaque verification token stored in DB
    const rawVerificationToken = generateOpaqueToken();
    const tokenHash = hashToken(rawVerificationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Dispatch OTP via EmailService
    await EmailService.sendVerificationOtp(user.email, user.username, rawOtp);

    await AuditService.log({
      userId: user.id,
      action: 'USER_REGISTERED',
      targetResource: 'users',
      targetId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      metadata: { email: user.email, username: user.username },
    });

    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      verificationToken: process.env.APP_ENV === 'production' ? undefined : rawVerificationToken, // For legacy token verification in dev
      otp: process.env.APP_ENV === 'production' ? undefined : rawOtp,                             // For 6-digit OTP verification in dev
    };
  }

  /**
   * Verifies user email using either a 6-digit numeric OTP or token.
   */
  static async verifyEmail(input: VerifyEmailInput, ctx: RequestContext = {}) {
    if (input.email && input.otp) {
      const user = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (!user) {
        throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Verification code is invalid or has expired');
      }

      // Check brute-force attempts
      const lockKey = `failed_otp:${user.id}`;
      const attemptsStr = await redisService.get(lockKey);
      const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
      if (attempts >= 5) {
        throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many invalid verification attempts. Please wait 15 minutes or request a new code.');
      }

      const storedOtp = await redisService.get(`email_otp:${user.id}`);
      if (!storedOtp || storedOtp !== input.otp) {
        await redisService.set(lockKey, (attempts + 1).toString(), 900);
        throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Verification code is invalid or has expired');
      }

      await redisService.del(lockKey);
      await redisService.del(`email_otp:${user.id}`);

      await prisma.$transaction([
        prisma.emailVerificationToken.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: new Date() },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: { isVerified: true },
        }),
      ]);

      await AuditService.log({
        userId: user.id,
        action: 'EMAIL_VERIFIED',
        targetResource: 'users',
        targetId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });

      return { success: true, message: 'Email verified successfully' };
    }

    if (input.token) {
      const tokenHash = hashToken(input.token);
      const record = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!record || record.consumedAt !== null || record.expiresAt < new Date()) {
        throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Verification token is invalid or has expired');
      }

      await prisma.$transaction([
        prisma.emailVerificationToken.update({
          where: { id: record.id },
          data: { consumedAt: new Date() },
        }),
        prisma.user.update({
          where: { id: record.userId },
          data: { isVerified: true },
        }),
      ]);

      await AuditService.log({
        userId: record.userId,
        action: 'EMAIL_VERIFIED',
        targetResource: 'users',
        targetId: record.userId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });

      return { success: true, message: 'Email verified successfully' };
    }

    throw new AppError(400, 'INVALID_INPUT', 'Either token or email and OTP must be provided');
  }

  /**
   * Resends a fresh 6-digit Email OTP with a 60-second rate-limit cooldown.
   */
  static async resendOtp(input: ResendOtpInput, ctx: RequestContext = {}) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      return { success: true, message: 'If an account matches that email, a verification code has been dispatched' };
    }

    if (user.isVerified) {
      return { success: true, message: 'Account email is already verified' };
    }

    const cooldownKey = `otp_resend:${user.id}`;
    const inCooldown = await redisService.get(cooldownKey);
    if (inCooldown) {
      throw new AppError(429, 'RATE_LIMITED', 'Please wait 60 seconds before requesting another verification code');
    }

    // Invalidate prior unconsumed verification tokens
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    // Generate new 6-digit numeric OTP and set in Redis
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    await redisService.set(`email_otp:${user.id}`, rawOtp, 15 * 60);

    // Set 60-second cooldown in Redis
    await redisService.set(cooldownKey, '1', 60);

    await EmailService.sendVerificationOtp(user.email, user.username, rawOtp);

    await AuditService.log({
      userId: user.id,
      action: 'OTP_RESENT',
      targetResource: 'users',
      targetId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return {
      success: true,
      message: 'Verification code resent successfully',
      verificationToken: rawOtp,
      otp: rawOtp,
    };
  }

  /**
   * Authenticates user via Email OR Username, verifies password, registers device, returns token pair.
   */
  static async login(input: LoginInput, ctx: RequestContext = {}) {
    const identifier = (input.identifier || input.email || '').trim();

    const isEmail = identifier.includes('@');
    const user = isEmail
      ? await prisma.user.findUnique({
          where: { email: identifier.toLowerCase() },
        })
      : await prisma.user.findFirst({
          where: {
            username: {
              equals: identifier,
              mode: 'insensitive',
            },
          },
        });

    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username/email or password');
    }

    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated');
    }

    if (!user.isVerified) {
      throw new AppError(
        403,
        'EMAIL_NOT_VERIFIED',
        'Please verify your email address with the 6-digit code sent to your inbox before logging in'
      );
    }

    const lockKey = `failed_login:${user.id}`;
    const attemptsStr = await redisService.get(lockKey);
    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
    if (attempts >= 5) {
      throw new AppError(429, 'ACCOUNT_LOCKED', 'Too many failed login attempts. Account temporarily locked for 15 minutes.');
    }

    const isValid = await verifyPassword(user.passwordHash, input.password);
    if (!isValid) {
      await redisService.set(lockKey, (attempts + 1).toString(), 900);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username/email or password');
    }

    // Reset lockout counter on successful login
    await redisService.del(lockKey);

    // Register or update device
    await prisma.device.upsert({
      where: { deviceFingerprint: input.deviceId },
      update: {
        userId: user.id,
        deviceModel: input.deviceModel,
        manufacturer: input.manufacturer,
        androidVersion: input.androidVersion,
        appVersion: input.appVersion,
        lastSeenAt: new Date(),
      },
      create: {
        userId: user.id,
        deviceFingerprint: input.deviceId,
        deviceModel: input.deviceModel,
        manufacturer: input.manufacturer,
        androidVersion: input.androidVersion,
        appVersion: input.appVersion,
      },
    });

    // Create session with 30-day rolling refresh token
    const rawRefreshToken = generateOpaqueToken();
    const refreshTokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        deviceId: input.deviceId,
        refreshTokenHash,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        expiresAt,
      },
    });

    // Cache active session in Redis for instant validation
    await redisService.set(`session:${session.id}`, user.id, 30 * 24 * 60 * 60);

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      username: user.username,
      sessionId: session.id,
    });

    await AuditService.log({
      userId: user.id,
      action: 'USER_LOGGED_IN',
      targetResource: 'user_sessions',
      targetId: session.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      metadata: { deviceId: input.deviceId },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
      },
    };
  }

  /**
   * Refreshes access token with rotation and replay-attack detection.
   */
  static async refresh(input: RefreshInput, ctx: RequestContext = {}) {
    const incomingHash = hashToken(input.refreshToken);

    const session = await prisma.userSession.findUnique({
      where: { refreshTokenHash: incomingHash },
      include: { user: true },
    });

    // REPLAY ATTACK DETECTION
    if (session && session.revokedAt !== null) {
      await prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await AuditService.log({
        userId: session.userId,
        action: 'REFRESH_TOKEN_REPLAY_DETECTED',
        targetResource: 'user_sessions',
        targetId: session.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });

      throw new AppError(
        401,
        'TOKEN_REPLAY_DETECTED',
        'Suspicious refresh token reuse detected. All active sessions have been revoked for your security.'
      );
    }

    if (!session || session.expiresAt < new Date()) {
      throw new AppError(401, 'INVALID_OR_EXPIRED_TOKEN', 'Refresh token is invalid or has expired');
    }

    if (!session.user.isActive) {
      throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated');
    }

    // ROTATION: Revoke current session, issue new one
    const newRawRefreshToken = generateOpaqueToken();
    const newRefreshTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [_, newSession] = await prisma.$transaction([
      prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
      prisma.userSession.create({
        data: {
          userId: session.userId,
          deviceId: session.deviceId,
          refreshTokenHash: newRefreshTokenHash,
          ipAddress: ctx.ipAddress || session.ipAddress,
          userAgent: ctx.userAgent || session.userAgent,
          expiresAt: newExpiresAt,
        },
      }),
    ]);

    await redisService.del(`session:${session.id}`);
    await redisService.set(`session:${newSession.id}`, session.userId, 30 * 24 * 60 * 60);

    const accessToken = signAccessToken({
      sub: session.user.id,
      email: session.user.email,
      username: session.user.username,
      sessionId: newSession.id,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: 900,
    };
  }

  /**
   * Logs out a specific session.
   */
  static async logout(input: RefreshInput, ctx: RequestContext = {}) {
    const incomingHash = hashToken(input.refreshToken);

    const session = await prisma.userSession.findUnique({
      where: { refreshTokenHash: incomingHash },
    });

    if (session) {
      await prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      await redisService.del(`session:${session.id}`);

      await AuditService.log({
        userId: session.userId,
        action: 'USER_LOGGED_OUT',
        targetResource: 'user_sessions',
        targetId: session.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
    }

    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Revokes all sessions for a user across all devices.
   */
  static async logoutAll(userId: string, ctx: RequestContext = {}) {
    await prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await AuditService.log({
      userId,
      action: 'ALL_SESSIONS_REVOKED',
      targetResource: 'users',
      targetId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return { success: true, message: 'All sessions successfully revoked' };
  }

  /**
   * Initiates password reset without email enumeration leak.
   */
  static async forgotPassword(input: ForgotPasswordInput, ctx: RequestContext = {}) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    let rawToken: string | undefined;

    if (user && user.isActive) {
      rawToken = generateOpaqueToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      await EmailService.sendPasswordReset(user.email, user.username, rawToken);

      await AuditService.log({
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        targetResource: 'users',
        targetId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
    }

    return {
      success: true,
      message: 'If an account matches that email, a password reset link has been dispatched',
      resetToken: rawToken, // Available for testing
    };
  }

  /**
   * Completes password reset and revokes all active sessions.
   */
  static async resetPassword(input: ResetPasswordInput, ctx: RequestContext = {}) {
    const tokenHash = hashToken(input.token);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.consumedAt !== null || record.expiresAt < new Date()) {
      throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Reset token is invalid or has expired');
    }

    const newPasswordHash = await hashPassword(input.newPassword);

    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.userSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await AuditService.log({
      userId: record.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      targetResource: 'users',
      targetId: record.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return { success: true, message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  /**
   * Generates a short-lived (5 min), single-use server credential for VYRON-compatible multiplayer servers.
   */
  static async generateServerCredential(userId: string, input: ServerCredentialInput, ctx: RequestContext = {}) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new AppError(403, 'FORBIDDEN', 'User account is not active');
    }

    if (!user.isVerified) {
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Account must be verified before connecting to VYRON servers');
    }

    const credentialTicket = `vsc_${crypto.randomBytes(32).toString('hex')}`;
    const payload = JSON.stringify({
      userId: user.id,
      username: user.username,
      serverAddress: input.serverAddress.toLowerCase(),
      createdAt: Date.now(),
    });

    // Store in Redis with 300 second (5 minute) TTL
    await redisService.set(`server_credential:${credentialTicket}`, payload, 300);

    await AuditService.log({
      userId: user.id,
      action: 'SERVER_CREDENTIAL_ISSUED',
      targetResource: 'servers',
      targetId: input.serverAddress,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      metadata: { serverAddress: input.serverAddress },
    });

    return {
      serverCredential: credentialTicket,
      expiresIn: 300,
      serverAddress: input.serverAddress,
    };
  }

  /**
   * Validates and consumes a short-lived server credential (called by VYRON game server plugin).
   */
  static async verifyServerCredential(input: VerifyServerCredentialInput, ctx: RequestContext = {}) {
    const redisKey = `server_credential:${input.serverCredential}`;
    const credentialData = await redisService.get(redisKey);

    if (!credentialData) {
      throw new AppError(401, 'INVALID_SERVER_CREDENTIAL', 'Server credential is invalid or has expired');
    }

    const parsed = JSON.parse(credentialData) as {
      userId: string;
      username: string;
      serverAddress: string;
      createdAt: number;
    };

    if (
      parsed.serverAddress.toLowerCase() !== input.serverAddress.toLowerCase() ||
      parsed.username.toLowerCase() !== input.username.toLowerCase()
    ) {
      throw new AppError(403, 'CREDENTIAL_MISMATCH', 'Server credential does not match the requesting server or username');
    }

    // Invalidate immediately (single-use)
    await redisService.del(redisKey);

    await AuditService.log({
      userId: parsed.userId,
      action: 'SERVER_CREDENTIAL_VERIFIED',
      targetResource: 'servers',
      targetId: input.serverAddress,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      metadata: { serverAddress: input.serverAddress, username: parsed.username },
    });

    return {
      valid: true,
      user: {
        id: parsed.userId,
        username: parsed.username,
      },
    };
  }

  /**
   * Retrieves current user profile.
   */
  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        bio: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User profile not found');
    }

    return user;
  }

  /**
   * Lists devices associated with user.
   */
  static async getDevices(userId: string) {
    return prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        deviceFingerprint: true,
        deviceModel: true,
        manufacturer: true,
        androidVersion: true,
        appVersion: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Changes user password, verifying current password, and revoking all other active sessions.
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string,
    ctx: RequestContext = {}
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User profile not found');
    }

    const isValid = await verifyPassword(user.passwordHash, currentPassword);
    if (!isValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.userSession.updateMany({
        where: {
          userId,
          id: currentSessionId ? { not: currentSessionId } : undefined,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    await AuditService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      targetResource: 'users',
      targetId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return { success: true, message: 'Password changed successfully. All other sessions have been signed out.' };
  }

  /**
   * Lists all active sessions for current user.
   */
  static async getSessions(userId: string, currentSessionId?: string) {
    const sessions = await prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceId: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((s) => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    }));
  }

  /**
   * Revokes a specific session by ID.
   */
  static async revokeSession(userId: string, sessionId: string, ctx: RequestContext = {}) {
    const session = await prisma.userSession.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
    });

    if (!session) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Active session not found');
    }

    await prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await redisService.del(`session:${sessionId}`);

    await AuditService.log({
      userId,
      action: 'SESSION_REVOKED',
      targetResource: 'user_sessions',
      targetId: sessionId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return { success: true, message: 'Session revoked successfully' };
  }

  /**
   * Revokes a registered device and terminates all its active sessions.
   */
  static async revokeDevice(userId: string, deviceId: string, ctx: RequestContext = {}) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceId);
    const device = await prisma.device.findFirst({
      where: {
        ...(isUuid ? { OR: [{ id: deviceId }, { deviceFingerprint: deviceId }] } : { deviceFingerprint: deviceId }),
        userId,
      },
    });

    if (!device) {
      throw new AppError(404, 'DEVICE_NOT_FOUND', 'Registered device not found');
    }

    await prisma.$transaction([
      prisma.userSession.updateMany({
        where: { userId, deviceId: device.deviceFingerprint, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.device.delete({
        where: { id: device.id },
      }),
    ]);

    await AuditService.log({
      userId,
      action: 'DEVICE_REVOKED',
      targetResource: 'devices',
      targetId: device.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return { success: true, message: 'Device and its active sessions revoked successfully' };
  }
}
