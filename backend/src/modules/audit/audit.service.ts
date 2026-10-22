import { prisma } from '../../db/prisma.js';

export interface AuditEventPayload {
  userId?: string | null;
  action: string;
  targetResource: string;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class AuditService {
  /**
   * Sanitizes metadata to strictly strip sensitive authentication secrets,
   * tokens, passwords, and credentials before recording.
   */
  private static sanitizeMetadata(metadata?: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!metadata) return null;

    const sanitized = { ...metadata };
    const forbiddenKeys = [
      'password',
      'password_hash',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'authorization',
      'tokenHash',
    ];

    for (const key of Object.keys(sanitized)) {
      if (forbiddenKeys.some(forbidden => key.toLowerCase().includes(forbidden.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Appends an immutable audit event to the database.
   */
  static async log(payload: AuditEventPayload): Promise<void> {
    return this.logEvent(payload);
  }

  static async logEvent(payload: AuditEventPayload): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: payload.userId || null,
          action: payload.action,
          targetResource: payload.targetResource,
          targetId: payload.targetId || null,
          ipAddress: payload.ipAddress || null,
          userAgent: payload.userAgent || null,
          requestId: payload.requestId || null,
          metadata: this.sanitizeMetadata(payload.metadata) as any,
        },
      });
    } catch (error) {
      // Audit failure should not crash the core flow but should be logged to stderr
      console.error('Failed to write immutable audit log event:', error);
    }
  }
}

export const auditService = AuditService;
