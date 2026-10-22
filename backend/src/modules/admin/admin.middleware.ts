import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, AccessTokenPayload } from '../../common/security/jwt.js';
import { hasPermission, hasAnyRole, AdminRole } from '../../common/security/rbac.js';
import { AppError } from '../../common/errors/app-error.js';

export interface AdminUserContext extends AccessTokenPayload {
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    adminUser?: AdminUserContext;
  }
}

/**
 * Fastify preHandler to authenticate staff requests via Bearer JWT.
 */
export async function authenticateAdmin(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or invalid Authorization header', 'MISSING_TOKEN');
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (!payload.role || payload.role === 'USER') {
    throw AppError.forbidden('Administrative privileges required', 'INSUFFICIENT_PRIVILEGES');
  }

  request.adminUser = {
    ...payload,
    role: payload.role,
  };
}

/**
 * Route guard requiring a specific RBAC permission.
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.adminUser) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHENTICATED');
    }

    if (!hasPermission(request.adminUser.role, permission)) {
      throw AppError.forbidden(`Missing required permission: ${permission}`, 'PERMISSION_DENIED');
    }
  };
}

/**
 * Route guard requiring one of the specified administrative roles.
 */
export function requireRole(allowedRoles: AdminRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.adminUser) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHENTICATED');
    }

    if (!hasAnyRole(request.adminUser.role, allowedRoles)) {
      throw AppError.forbidden('Role not authorized for this operation', 'ROLE_NOT_AUTHORIZED');
    }
  };
}
