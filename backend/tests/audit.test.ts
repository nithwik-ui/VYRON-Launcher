import { describe, it, expect, afterAll } from 'vitest';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { prisma } from '../src/db/prisma.js';

describe('Audit Log Foundation', () => {

  it('should log an immutable audit event and scrub sensitive keys from metadata', async () => {
    const testAction = 'TEST_SECURITY_EVENT';
    const testResource = 'users';

    await AuditService.logEvent({
      action: testAction,
      targetResource: testResource,
      targetId: 'test-user-id-001',
      ipAddress: '127.0.0.1',
      userAgent: 'VyronTestAgent/1.0',
      requestId: 'req-audit-test',
      metadata: {
        safeField: 'safeValue',
        password: 'PlainTextPassword123!',
        accessToken: 'Bearer eyJsecret',
        refreshToken: 'rt_secret',
      },
    });

    // Query back the event
    const recorded = await prisma.auditLog.findFirst({
      where: {
        action: testAction,
        targetResource: testResource,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(recorded).toBeDefined();
    expect(recorded?.action).toBe(testAction);
    expect(recorded?.targetResource).toBe(testResource);
    expect(recorded?.metadata).toBeDefined();

    const meta = recorded?.metadata as Record<string, unknown>;
    expect(meta.safeField).toBe('safeValue');
    expect(meta.password).toBe('[REDACTED]');
    expect(meta.accessToken).toBe('[REDACTED]');
    expect(meta.refreshToken).toBe('[REDACTED]');
  });

  it('should enforce append-only semantics with no update/delete APIs on AuditService', () => {
    // AuditService must strictly expose only logging/read mechanisms, never update or delete
    const serviceMethods = Object.getOwnPropertyNames(AuditService);
    expect(serviceMethods).not.toContain('update');
    expect(serviceMethods).not.toContain('delete');
    expect(serviceMethods).not.toContain('updateEvent');
    expect(serviceMethods).not.toContain('deleteEvent');
    expect(typeof AuditService.logEvent).toBe('function');
  });
});
