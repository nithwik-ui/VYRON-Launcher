export type AdminRole =
  | 'SUPER_ADMIN'
  | 'CONTENT_ADMIN'
  | 'SERVER_ADMIN'
  | 'RELEASE_ADMIN'
  | 'MODERATOR'
  | 'SUPPORT_ADMIN'
  | 'ANALYTICS'
  | 'USER';

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  SUPER_ADMIN: ['*'],
  CONTENT_ADMIN: [
    'news:*',
    'news:create',
    'news:update',
    'news:delete',
    'announcements:*',
    'announcements:create',
    'announcements:update',
    'announcements:delete',
    'media:*',
  ],
  SERVER_ADMIN: [
    'servers:*',
    'servers:verify',
    'servers:update',
    'servers:delete',
    'promotions:*',
    'campaigns:*',
  ],
  RELEASE_ADMIN: [
    'releases:*',
    'rollouts:*',
    'minecraft:*',
    'minecraft:sync',
    'compatibility:*',
    'runtimes:*',
  ],
  MODERATOR: [
    'reports:read',
    'reports:resolve',
    'servers:flag',
    'users:suspend',
  ],
  SUPPORT_ADMIN: [
    'support:*',
    'crashes:read',
    'users:read',
  ],
  ANALYTICS: [
    'analytics:read',
    'telemetry:read',
  ],
  USER: [],
};

/**
 * Checks if a user's role grants a required permission.
 * Supports wildcard '*' and domain wildcards (e.g. 'news:*' matches 'news:create').
 */
export function hasPermission(role: string, requiredPermission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role as AdminRole] || [];

  if (permissions.includes('*')) {
    return true;
  }

  if (permissions.includes(requiredPermission)) {
    return true;
  }

  // Check domain wildcard (e.g. required: 'news:create', granted: 'news:*')
  const [domain] = requiredPermission.split(':');
  if (permissions.includes(`${domain}:*`)) {
    return true;
  }

  return false;
}

/**
 * Checks if a user possesses one of the authorized roles.
 */
export function hasAnyRole(userRole: string, allowedRoles: AdminRole[]): boolean {
  if (userRole === 'SUPER_ADMIN') {
    return true;
  }
  return allowedRoles.includes(userRole as AdminRole);
}
