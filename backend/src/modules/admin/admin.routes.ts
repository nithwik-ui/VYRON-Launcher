import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { adminService } from './admin.service.js';
import {
  authenticateAdmin,
  requirePermission,
  requireRole,
} from './admin.middleware.js';
import {
  adminLoginSchema,
  verifyTotpSchema,
  assignRoleSchema,
  updateArticleAdminSchema,
  queryAuditLogsSchema,
} from './admin.schemas.js';
import { z } from 'zod';
import { renderAdminDashboardHtml } from './dashboard.js';

export const adminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/admin
   * Serves the single unified VYRON Control Center web application.
   */
  app.get('/admin', async (_request, reply) => {
    reply.type('text/html');
    return renderAdminDashboardHtml();
  });

  /**
   * POST /api/v1/admin/auth/login
   * Authenticate staff with email, password, and optional TOTP code.
   */
  app.post('/admin/auth/login', async (request, reply) => {
    const body = adminLoginSchema.parse(request.body);
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    const result = await adminService.login(body, ipAddress, userAgent);
    return {
      success: true,
      data: result,
    };
  });

  /**
   * POST /api/v1/admin/totp/setup
   * Initiate TOTP two-factor authentication setup for authenticated staff.
   */
  app.post('/admin/totp/setup', { preHandler: [authenticateAdmin] }, async (request, reply) => {
    const userId = request.adminUser!.sub;
    const result = await adminService.setupTotp(userId);

    return {
      success: true,
      data: result,
    };
  });

  /**
   * POST /api/v1/admin/totp/verify
   * Verify TOTP code and activate MFA on staff account.
   */
  app.post('/admin/totp/verify', { preHandler: [authenticateAdmin] }, async (request, reply) => {
    const userId = request.adminUser!.sub;
    const body = verifyTotpSchema.parse(request.body);
    const result = await adminService.verifyAndEnableTotp(userId, body.totpCode);

    return result;
  });

  /**
   * GET /api/v1/admin/me
   * Retrieve active staff identity, assigned role, and permissions bitmask.
   */
  app.get('/admin/me', { preHandler: [authenticateAdmin] }, async (request, reply) => {
    return {
      success: true,
      data: {
        id: request.adminUser!.sub,
        email: request.adminUser!.email,
        username: request.adminUser!.username,
        role: request.adminUser!.role,
        permissions: request.adminUser!.permissions,
      },
    };
  });

  /**
   * GET /api/v1/admin/users
   * List platform users for moderation & administration.
   */
  app.get(
    '/admin/users',
    { preHandler: [authenticateAdmin, requireRole(['SUPER_ADMIN', 'MODERATOR', 'SUPPORT_ADMIN'])] },
    async (request, reply) => {
      const query = z
        .object({
          limit: z.coerce.number().int().min(1).max(100).default(50),
          offset: z.coerce.number().int().min(0).default(0),
          role: z.string().optional(),
          search: z.string().optional(),
        })
        .parse(request.query);

      const result = await adminService.listUsers(query);
      return {
        success: true,
        data: result.users,
        pagination: result.pagination,
      };
    }
  );

  /**
   * POST /api/v1/admin/users/:id/role
   * Assign administrative staff role to a user (requires SUPER_ADMIN).
   */
  app.post(
    '/admin/users/:id/role',
    { preHandler: [authenticateAdmin, requireRole(['SUPER_ADMIN'])] },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = assignRoleSchema.parse(request.body);

      const updated = await adminService.assignRole(request.adminUser!.sub, params.id, body);
      return {
        success: true,
        data: updated,
      };
    }
  );

  /**
   * PUT /api/v1/admin/news/:id
   * Update article details or publication status (requires news:update).
   */
  app.put(
    '/admin/news/:id',
    { preHandler: [authenticateAdmin, requirePermission('news:update')] },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = updateArticleAdminSchema.parse(request.body);

      const updated = await adminService.updateArticle(request.adminUser!.sub, params.id, body);
      return {
        success: true,
        data: updated,
      };
    }
  );

  /**
   * DELETE /api/v1/admin/news/:id
   * Delete article (requires news:delete).
   */
  app.delete(
    '/admin/news/:id',
    { preHandler: [authenticateAdmin, requirePermission('news:delete')] },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await adminService.deleteArticle(request.adminUser!.sub, params.id);
      return result;
    }
  );

  /**
   * DELETE /api/v1/admin/announcements/:id
   * Remove urgent announcement banner (requires announcements:delete).
   */
  app.delete(
    '/admin/announcements/:id',
    { preHandler: [authenticateAdmin, requirePermission('announcements:delete')] },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await adminService.deleteAnnouncement(request.adminUser!.sub, params.id);
      return result;
    }
  );

  /**
   * GET /api/v1/admin/audit-logs
   * Inspect immutable administrative audit trail (requires SUPER_ADMIN or ANALYTICS).
   */
  app.get(
    '/admin/audit-logs',
    { preHandler: [authenticateAdmin, requireRole(['SUPER_ADMIN', 'ANALYTICS'])] },
    async (request, reply) => {
      const query = queryAuditLogsSchema.parse(request.query);
      const result = await adminService.queryAuditLogs(query);

      return {
        success: true,
        data: result.logs,
        pagination: result.pagination,
      };
    }
  );
};
