import { prisma } from '../../db/prisma.js';
import { verifyPassword } from '../../common/security/password.js';
import { signAccessToken } from '../../common/security/jwt.js';
import {
  generateTotpSecret,
  verifyTotpCode,
  getTotpUri,
} from '../../common/security/totp.js';
import { ROLE_PERMISSIONS, AdminRole } from '../../common/security/rbac.js';
import { auditService } from '../audit/audit.service.js';
import { redisService } from '../../redis/client.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  AdminLoginInput,
  AssignRoleInput,
  UpdateArticleAdminInput,
  QueryAuditLogsInput,
} from './admin.schemas.js';

export class AdminService {
  /**
   * Staff login with role verification and TOTP 2FA.
   */
  async login(input: AdminLoginInput, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user || user.role === 'USER') {
      throw AppError.unauthorized('Invalid administrative credentials or insufficient privileges', 'UNAUTHORIZED_ACCESS');
    }

    if (!user.isActive) {
      throw AppError.forbidden('Administrative account has been suspended', 'ACCOUNT_SUSPENDED');
    }

    const isValidPassword = await verifyPassword(user.passwordHash, input.password);
    if (!isValidPassword) {
      throw AppError.unauthorized('Invalid administrative credentials', 'INVALID_CREDENTIALS');
    }

    // Enforce TOTP MFA if enabled on the staff account
    if (user.isTotpEnabled) {
      if (!input.totpCode) {
        throw AppError.badRequest('Two-factor authentication code (TOTP) is required', 'MFA_REQUIRED');
      }

      const isValidTotp = verifyTotpCode(user.totpSecret!, input.totpCode);
      if (!isValidTotp) {
        throw AppError.unauthorized('Invalid or expired two-factor authentication code', 'INVALID_MFA_CODE');
      }
    }

    const permissions = ROLE_PERMISSIONS[user.role as AdminRole] || [];

    const token = signAccessToken(
      {
        sub: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        permissions,
      },
      8 * 3600 // 8 hours administrative session token
    );

    await auditService.log({
      userId: user.id,
      action: 'STAFF_LOGIN',
      targetResource: 'admin_session',
      targetId: user.id,
      ipAddress,
      userAgent,
      metadata: { role: user.role, mfaUsed: user.isTotpEnabled },
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        permissions,
        isTotpEnabled: user.isTotpEnabled,
      },
    };
  }

  /**
   * Set up TOTP 2FA for a staff user. Returns secret and otpauth URI for QR code.
   */
  async setupTotp(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    }

    const secret = generateTotpSecret(20);
    const uri = getTotpUri(user.username, secret, 'VYRON Control Center');

    // Save secret with isTotpEnabled: false until verified
    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret },
    });

    return {
      secret,
      uri,
    };
  }

  /**
   * Confirms TOTP verification code and activates MFA on the account.
   */
  async verifyAndEnableTotp(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw AppError.badRequest('No pending TOTP secret found for this account', 'NO_PENDING_MFA');
    }

    const isValid = verifyTotpCode(user.totpSecret, code);
    if (!isValid) {
      throw AppError.badRequest('Invalid or expired verification code', 'INVALID_MFA_CODE');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isTotpEnabled: true },
    });

    await auditService.log({
      userId,
      action: 'TOTP_MFA_ENABLED',
      targetResource: 'users',
      targetId: userId,
    });

    return {
      success: true,
      message: 'Two-factor authentication successfully enabled',
    };
  }

  /**
   * Assigns an administrative role to a user. Requires SUPER_ADMIN.
   */
  async assignRole(actorUserId: string, targetUserId: string, input: AssignRoleInput) {
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw AppError.notFound('Target user not found', 'USER_NOT_FOUND');
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: input.role },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isVerified: true,
        isTotpEnabled: true,
        updatedAt: true,
      },
    });

    await auditService.log({
      userId: actorUserId,
      action: 'STAFF_ROLE_ASSIGNED',
      targetResource: 'users',
      targetId: targetUserId,
      metadata: {
        oldRole: targetUser.role,
        newRole: input.role,
      },
    });

    return updated;
  }

  /**
   * List platform users with role and status for moderation.
   */
  async listUsers(params: { limit?: number; offset?: number; role?: string; search?: string }) {
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const where: Record<string, unknown> = {};
    if (params.role) {
      where.role = params.role;
    }
    if (params.search) {
      where.OR = [
        { username: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          isVerified: true,
          isTotpEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + users.length < total,
      },
    };
  }

  /**
   * Update article (Staff / Content Admin).
   */
  async updateArticle(actorUserId: string, articleId: string, input: UpdateArticleAdminInput) {
    const article = await prisma.newsArticle.findUnique({ where: { id: articleId } });
    if (!article) {
      throw AppError.notFound('Article not found', 'ARTICLE_NOT_FOUND');
    }

    const updated = await prisma.newsArticle.update({
      where: { id: articleId },
      data: {
        ...input,
        publishedAt: input.status === 'PUBLISHED' && !article.publishedAt ? new Date() : undefined,
      },
    });

    await redisService.del(`cache:news:slug:${article.slug}`);
    await this.invalidateNewsLists();

    await auditService.log({
      userId: actorUserId,
      action: 'ARTICLE_UPDATED',
      targetResource: 'news_articles',
      targetId: articleId,
      metadata: { changes: Object.keys(input) },
    });

    return updated;
  }

  /**
   * Delete article (Staff / Content Admin).
   */
  async deleteArticle(actorUserId: string, articleId: string) {
    const article = await prisma.newsArticle.findUnique({ where: { id: articleId } });
    if (!article) {
      throw AppError.notFound('Article not found', 'ARTICLE_NOT_FOUND');
    }

    await prisma.newsArticle.delete({ where: { id: articleId } });

    await redisService.del(`cache:news:slug:${article.slug}`);
    await this.invalidateNewsLists();

    await auditService.log({
      userId: actorUserId,
      action: 'ARTICLE_DELETED',
      targetResource: 'news_articles',
      targetId: articleId,
      metadata: { slug: article.slug, title: article.title },
    });

    return { success: true };
  }

  /**
   * Delete announcement banner.
   */
  async deleteAnnouncement(actorUserId: string, id: string) {
    const item = await prisma.announcement.findUnique({ where: { id } });
    if (!item) {
      throw AppError.notFound('Announcement not found', 'ANNOUNCEMENT_NOT_FOUND');
    }

    await prisma.announcement.delete({ where: { id } });
    await redisService.del('cache:announcements:active');

    await auditService.log({
      userId: actorUserId,
      action: 'ANNOUNCEMENT_DELETED',
      targetResource: 'announcements',
      targetId: id,
    });

    return { success: true };
  }

  /**
   * Query immutable system audit logs.
   */
  async queryAuditLogs(params: QueryAuditLogsInput) {
    const where: Record<string, unknown> = {};
    if (params.action) {
      where.action = params.action;
    }
    if (params.userId) {
      where.userId = params.userId;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.offset,
        take: params.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + logs.length < total,
      },
    };
  }

  private async invalidateNewsLists() {
    const commonKeys = [
      'cache:news:list:all:any:10:0',
      'cache:news:list:all:true:10:0',
      'cache:news:list:all:false:10:0',
      'cache:news:list:updates:any:10:0',
    ];
    for (const key of commonKeys) {
      await redisService.del(key);
    }
  }
}

export const adminService = new AdminService();
