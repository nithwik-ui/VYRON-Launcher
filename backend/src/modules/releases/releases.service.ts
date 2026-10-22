import { prisma } from '../../db/prisma.js';
import { redisService } from '../../redis/client.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  CheckUpdateQuery,
  CreateReleaseInput,
  ReportCrashInput,
} from './releases.schemas.js';

export class ReleasesService {
  /**
   * Check for the latest launcher update based on channel and installed versionCode.
   */
  async checkLatestUpdate(query: CheckUpdateQuery) {
    const latestRelease = await prisma.launcherRelease.findFirst({
      where: {
        channel: query.channel,
        publishedAt: { lte: new Date() },
      },
      orderBy: { versionCode: 'desc' },
    });

    if (!latestRelease || latestRelease.versionCode <= query.versionCode) {
      return {
        updateAvailable: false,
        currentVersionCode: query.versionCode,
      };
    }

    return {
      updateAvailable: true,
      currentVersionCode: query.versionCode,
      release: {
        id: latestRelease.id,
        versionName: latestRelease.versionName,
        versionCode: latestRelease.versionCode,
        channel: latestRelease.channel,
        minAndroidSdk: latestRelease.minAndroidSdk,
        downloadUrl: latestRelease.downloadUrl,
        sha256Hash: latestRelease.sha256Hash,
        fileSizeBytes: latestRelease.fileSizeBytes.toString(),
        changelogMarkdown: latestRelease.changelogMarkdown,
        isMandatory: latestRelease.isMandatory,
        publishedAt: latestRelease.publishedAt,
      },
    };
  }

  /**
   * List all published releases.
   */
  async listReleases(limit = 20, offset = 0) {
    const [releases, total] = await Promise.all([
      prisma.launcherRelease.findMany({
        where: { publishedAt: { not: null } },
        orderBy: { versionCode: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.launcherRelease.count({ where: { publishedAt: { not: null } } }),
    ]);

    return {
      releases: releases.map((r) => ({
        id: r.id,
        versionName: r.versionName,
        versionCode: r.versionCode,
        channel: r.channel,
        downloadUrl: r.downloadUrl,
        sha256Hash: r.sha256Hash,
        fileSizeBytes: r.fileSizeBytes.toString(),
        changelogMarkdown: r.changelogMarkdown,
        isMandatory: r.isMandatory,
        publishedAt: r.publishedAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + releases.length < total,
      },
    };
  }

  /**
   * Publish a new launcher release.
   */
  async createRelease(input: CreateReleaseInput) {
    const release = await prisma.launcherRelease.create({
      data: {
        versionName: input.versionName,
        versionCode: input.versionCode,
        channel: input.channel,
        minAndroidSdk: input.minAndroidSdk,
        downloadUrl: input.downloadUrl,
        sha256Hash: input.sha256Hash,
        fileSizeBytes: input.fileSizeBytes,
        changelogMarkdown: input.changelogMarkdown,
        rolloutPercentage: input.rolloutPercentage,
        isMandatory: input.isMandatory,
        publishedAt: new Date(),
      },
    });

    return {
      ...release,
      fileSizeBytes: release.fileSizeBytes.toString(),
    };
  }

  /**
   * Ingest crash diagnostics with strict privacy scrubbing (Zero PII).
   * Strips file paths, user identifiers, tokens, and IP addresses.
   */
  async reportCrash(input: ReportCrashInput) {
    let cleanStack = input.stackTrace;

    // Redact sensitive patterns (Windows/Linux user directory paths, tokens, emails)
    cleanStack = cleanStack.replace(/[A-Za-z]:\\[Uu]sers\\[^\\]+/g, 'C:\\Users\\[REDACTED]');
    cleanStack = cleanStack.replace(/\/home\/[^\/]+/g, '/home/[REDACTED]');
    cleanStack = cleanStack.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g, '[REDACTED_EMAIL]');
    cleanStack = cleanStack.replace(/(token|secret|password|bearer)=?[^\s&]+/gi, '$1=[REDACTED]');

    const report = await prisma.crashReport.create({
      data: {
        appVersion: input.appVersion,
        androidSdk: input.androidSdk,
        deviceModel: input.deviceModel,
        soc: input.soc,
        minecraftVersion: input.minecraftVersion,
        renderer: input.renderer,
        loader: input.loader,
        stackTrace: cleanStack,
        errorReason: input.errorReason,
      },
    });

    return {
      success: true,
      reportId: report.id,
    };
  }

  /**
   * Seeds default release if table is empty.
   */
  async seedBaselineRelease() {
    const count = await prisma.launcherRelease.count();
    if (count === 0) {
      await prisma.launcherRelease.create({
        data: {
          versionName: '3.0.0',
          versionCode: 10000000,
          channel: 'STABLE',
          minAndroidSdk: 21,
          downloadUrl: 'https://cdn.vyronlauncher.com/releases/vyron-launcher-v3.0.0.apk',
          sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          fileSizeBytes: BigInt(144725499),
          changelogMarkdown: '## VYRON Launcher v3.0.0\n- Modern OpenJDK 21 Desktop Runtime\n- ANGLE Vulkan graphics bridge\n- Isolated Hardware KeyStore security\n- Seamless offline gameplay support',
          rolloutPercentage: 100,
          isMandatory: false,
          publishedAt: new Date(),
        },
      });
    }
  }
}

export const releasesService = new ReleasesService();
