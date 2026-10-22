import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { disconnectDatabase, prisma } from '../src/db/prisma.js';
import { redisService } from '../src/redis/client.js';
import { releasesService } from '../src/modules/releases/releases.service.js';
import { signAccessToken } from '../src/common/security/jwt.js';

describe('Phase 3G — Compatibility & Release Intelligence', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    await releasesService.seedBaselineRelease();

    adminToken = signAccessToken({
      sub: '00000000-0000-0000-0000-000000000001',
      email: 'release_admin@vyronlauncher.com',
      username: 'ReleaseAdmin',
      role: 'RELEASE_ADMIN',
      permissions: ['releases:*', 'rollouts:*'],
    });
  });

  afterAll(async () => {
    await app.close();
    await disconnectDatabase();
    await redisService.disconnect();
  });

  it('GET /api/v1/releases/latest should indicate up-to-date when client has current versionCode', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/releases/latest?channel=STABLE&versionCode=10000000',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.updateAvailable).toBe(false);
  });

  it('GET /api/v1/releases/latest should offer upgrade when newer versionCode is published', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/releases/latest?channel=STABLE&versionCode=100',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.updateAvailable).toBe(true);
    expect(body.data.release).toBeDefined();
    expect(body.data.release.versionName).toBe('3.0.0');
    expect(body.data.release.downloadUrl).toContain('vyron-launcher-v3.0.0.apk');
  });

  it('POST /api/v1/telemetry/crash should ingest crash logs with strict Non-PII scrubbing', async () => {
    const dirtyStackTrace =
      'Exception in thread "main" java.lang.RuntimeException: Game crashed\n' +
      '  at net.minecraft.client.main.Main.main(SourceFile:123)\n' +
      '  at C:\\Users\\JohnDoe\\AppData\\Local\\Pojav\\runtime.jar\n' +
      '  caused by: token=secret_session_token_12345 user=player@example.com';

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry/crash',
      payload: {
        appVersion: '3.0.0',
        androidSdk: 35,
        deviceModel: 'Pixel 9 Pro',
        soc: 'Google Tensor G4',
        minecraftVersion: '1.21.4',
        renderer: 'ANGLE',
        loader: 'Fabric',
        stackTrace: dirtyStackTrace,
        errorReason: 'SIGSEGV in Vulkan pipeline',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.reportId).toBeDefined();

    // Verify stored report is scrubbed
    const stored = await prisma.crashReport.findUnique({ where: { id: body.data.reportId } });
    expect(stored).toBeDefined();
    expect(stored!.stackTrace).not.toContain('JohnDoe');
    expect(stored!.stackTrace).toContain('[REDACTED]');
    expect(stored!.stackTrace).not.toContain('player@example.com');
    expect(stored!.stackTrace).toContain('[REDACTED_EMAIL]');

    // Clean up test crash report
    await prisma.crashReport.delete({ where: { id: body.data.reportId } });
  });

  it('POST /api/v1/admin/releases should allow RELEASE_ADMIN to publish staged rollouts', async () => {
    const newVersionCode = 10000001;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/releases',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        versionName: '3.0.1',
        versionCode: newVersionCode,
        channel: 'STABLE',
        minAndroidSdk: 21,
        downloadUrl: 'https://cdn.vyronlauncher.com/releases/vyron-launcher-v3.0.1.apk',
        sha256Hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        fileSizeBytes: 145000000,
        changelogMarkdown: 'Bugfix for Snapdragon GPU driver stall',
        rolloutPercentage: 25,
        isMandatory: false,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.versionName).toBe('3.0.1');

    // Clean up test release
    await prisma.launcherRelease.deleteMany({ where: { versionCode: newVersionCode } });
  });
});
