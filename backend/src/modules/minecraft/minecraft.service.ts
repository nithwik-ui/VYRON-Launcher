import { prisma } from '../../db/prisma.js';
import { redisService } from '../../redis/client.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  ListMinecraftVersionsQuery,
  QueryCompatibilityInput,
  SyncVersionsQuery,
} from './minecraft.schemas.js';

export interface MojangManifestVersion {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
  sha1: string;
  complianceLevel: number;
}

export interface MojangManifestV2 {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MojangManifestVersion[];
}

export class MinecraftService {
  private readonly MOJANG_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

  /**
   * Derives the required minimum Java major version from Minecraft version identifier.
   */
  deriveMinJavaVersion(versionId: string): number {
    // Modern Java 21: Minecraft 1.20.5+ and snapshots from 24w14a+
    if (/^1\.(2[1-9]|20\.[5-9])/.test(versionId) || /^(24w|25w)/.test(versionId)) {
      return 21;
    }
    // Java 17: Minecraft 1.17 to 1.20.4 and snapshots 21w19a to 24w13a
    if (/^1\.(1[7-9]|20(\.[0-4])?)/.test(versionId) || /^(2[1-3]w)/.test(versionId)) {
      return 17;
    }
    // Legacy Java 8: Minecraft 1.16.5 and older
    return 8;
  }

  /**
   * List indexed versions with caching and type filtering.
   */
  async listVersions(params: ListMinecraftVersionsQuery) {
    const cacheKey = `cache:minecraft:versions:${params.type}:${params.limit}:${params.offset}`;
    const cached = await redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Fall through
      }
    }

    // Auto-seed baseline versions if database has none
    const currentCount = await prisma.minecraftVersion.count();
    if (currentCount === 0) {
      await this.seedBaselineVersions();
    }

    const whereClause: Record<string, unknown> = {
      isPublished: true,
    };

    if (params.type && params.type !== 'all') {
      whereClause.versionType = params.type;
    }

    const [versions, total] = await Promise.all([
      prisma.minecraftVersion.findMany({
        where: whereClause,
        include: {
          metadata: {
            select: {
              minJavaVersion: true,
              mainClass: true,
              assetIndexId: true,
            },
          },
        },
        orderBy: { releaseTime: 'desc' },
        skip: params.offset,
        take: params.limit,
      }),
      prisma.minecraftVersion.count({ where: whereClause }),
    ]);

    const result = {
      versions: versions.map((v) => ({
        id: v.id,
        type: v.versionType,
        releaseTime: v.releaseTime,
        minJavaVersion: v.metadata?.minJavaVersion ?? this.deriveMinJavaVersion(v.id),
        recommendedRenderer: 'ANGLE',
        isSupported: true,
      })),
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + versions.length < total,
      },
    };

    await redisService.set(cacheKey, JSON.stringify(result), 3600); // 1-hour cache

    return result;
  }

  /**
   * Get technical prerequisites and metadata for a specific Minecraft version.
   * STRICT INVARIANT: Zero client JAR or game asset mirroring.
   */
  async getVersionDetails(id: string) {
    const cacheKey = `cache:minecraft:version:${id}`;
    const cached = await redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Fall through
      }
    }

    let version = await prisma.minecraftVersion.findUnique({
      where: { id },
      include: {
        metadata: true,
        compatibility: true,
      },
    });

    if (!version) {
      // Auto-populate on-demand if it is a recognized baseline version
      await this.seedBaselineVersions();
      version = await prisma.minecraftVersion.findUnique({
        where: { id },
        include: {
          metadata: true,
          compatibility: true,
        },
      });
    }

    if (!version) {
      throw AppError.notFound(`Minecraft version '${id}' not found in index`, 'VERSION_NOT_FOUND');
    }

    const minJava = version.metadata?.minJavaVersion ?? this.deriveMinJavaVersion(version.id);

    const result = {
      id: version.id,
      type: version.versionType,
      releaseTime: version.releaseTime,
      pistonUrl: version.pistonUrl,
      sha1Hash: version.sha1Hash,
      minJavaVersion: minJava,
      mainClass: version.metadata?.mainClass ?? 'net.minecraft.client.main.Main',
      assetIndexId: version.metadata?.assetIndexId ?? version.id,
      requiredLibraries: version.metadata?.requiredLibraries ?? [],
      recommendedRenderer: 'ANGLE',
      isSupported: true,
    };

    await redisService.set(cacheKey, JSON.stringify(result), 3600);

    return result;
  }

  /**
   * Hardware compatibility matrix query.
   */
  async queryCompatibility(input: QueryCompatibilityInput) {
    const profile = await prisma.compatibilityProfile.findFirst({
      where: {
        minecraftVersion: input.version,
        deviceSoc: input.soc,
        gpuRenderer: input.renderer,
      },
    });

    const recommendedJava = this.deriveMinJavaVersion(input.version);
    const recommendedRam = recommendedJava >= 21 ? 2048 : recommendedJava >= 17 ? 1536 : 1024;

    if (profile) {
      return {
        status: profile.status,
        minecraftVersion: profile.minecraftVersion,
        recommendedJava: profile.recommendedJava,
        recommendedRenderer: profile.gpuRenderer,
        recommendedRamMb: profile.recommendedRamMb,
        notes: profile.notes || 'Verified hardware profile configuration.',
      };
    }

    // Dynamic fallback profile based on architecture and version tier
    return {
      status: 'SUPPORTED',
      minecraftVersion: input.version,
      recommendedJava,
      recommendedRenderer: input.renderer || 'ANGLE',
      recommendedRamMb: recommendedRam,
      notes: `Optimal mobile rendering achieved via ${input.renderer || 'ANGLE'} graphics pipeline.`,
    };
  }

  /**
   * Synchronize version metadata from official Mojang Piston Manifest v2.
   * Adheres strictly to zero client JAR mirroring.
   */
  async syncWithMojangManifest(query?: SyncVersionsQuery) {
    let manifestData: MojangManifestV2 | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(this.MOJANG_MANIFEST_URL, {
        signal: controller.signal,
        headers: { 'User-Agent': 'VYRON-Launcher-Backend/1.0 (Mojang Manifest Ingestion)' },
      });
      clearTimeout(timeout);

      if (res.ok) {
        manifestData = (await res.json()) as MojangManifestV2;
      }
    } catch {
      // Fallback gracefully on network timeout
    }

    const limit = query?.limit || 30;
    let syncedCount = 0;

    if (manifestData && Array.isArray(manifestData.versions)) {
      const slice = manifestData.versions.slice(0, limit);
      for (const item of slice) {
        const minJava = this.deriveMinJavaVersion(item.id);

        await prisma.minecraftVersion.upsert({
          where: { id: item.id },
          update: {
            versionType: item.type,
            releaseTime: new Date(item.releaseTime),
            pistonUrl: item.url,
            sha1Hash: item.sha1,
            complianceLevel: item.complianceLevel || 0,
          },
          create: {
            id: item.id,
            versionType: item.type,
            releaseTime: new Date(item.releaseTime),
            pistonUrl: item.url,
            sha1Hash: item.sha1,
            complianceLevel: item.complianceLevel || 0,
            isPublished: true,
          },
        });

        await prisma.minecraftVersionMetadata.upsert({
          where: { versionId: item.id },
          update: { minJavaVersion: minJava },
          create: {
            versionId: item.id,
            minJavaVersion: minJava,
            mainClass: 'net.minecraft.client.main.Main',
            assetIndexId: item.id,
            requiredLibraries: [],
          },
        });

        syncedCount++;
      }
    } else {
      // Fallback seed
      syncedCount = await this.seedBaselineVersions();
    }

    // Invalidate cached version lists
    await this.invalidateVersionCaches();

    return {
      syncedCount,
      latestRelease: manifestData?.latest?.release || '1.21.4',
      latestSnapshot: manifestData?.latest?.snapshot || '24w50a',
    };
  }

  /**
   * Seed baseline releases into PostgreSQL if unpopulated.
   */
  async seedBaselineVersions(): Promise<number> {
    const baselines = [
      { id: '1.21.4', type: 'release', time: '2024-12-03T12:00:00Z', java: 21, sha1: '028b16a7f05c48b265bb6d0b63b2f5d9d784a961' },
      { id: '1.21.1', type: 'release', time: '2024-08-08T12:00:00Z', java: 21, sha1: 'e45922332675685ea75191fb4638a2e1d03c206e' },
      { id: '1.20.4', type: 'release', time: '2023-12-07T12:00:00Z', java: 17, sha1: '3df2194c25f1cbf583c2ad2c35a8bc3571d7c073' },
      { id: '1.20.1', type: 'release', time: '2023-06-12T12:00:00Z', java: 17, sha1: '3be22b51347087f9850e50fbf92367d300b991cf' },
      { id: '1.19.4', type: 'release', time: '2023-03-14T12:00:00Z', java: 17, sha1: '5c0e251cf440266e74b33b00693a2e3a89073efd' },
      { id: '1.18.2', type: 'release', time: '2022-02-28T12:00:00Z', java: 17, sha1: '254552e646274431525a74656ec5c9e224e7ebff' },
      { id: '1.16.5', type: 'release', time: '2021-01-15T12:00:00Z', java: 8, sha1: '37d3e92976179518e16f27632160165243374ca7' },
      { id: '1.12.2', type: 'release', time: '2017-09-18T12:00:00Z', java: 8, sha1: '0f275bc1547d070d860bd80939c8fad1c5fcaa08' },
      { id: '1.8.9', type: 'release', time: '2015-12-03T12:00:00Z', java: 8, sha1: '0ec00f40d990b7952467eb3f1eec5b4a52ff37c8' },
      { id: '1.7.10', type: 'release', time: '2014-06-26T12:00:00Z', java: 8, sha1: '2c5a2c2ef164c01284d72bcad7a6839be9b22a27' },
    ];

    let count = 0;
    for (const b of baselines) {
      await prisma.minecraftVersion.upsert({
        where: { id: b.id },
        update: {
          versionType: b.type,
          releaseTime: new Date(b.time),
          pistonUrl: `https://piston-meta.mojang.com/v1/packages/${b.sha1}/${b.id}.json`,
          sha1Hash: b.sha1,
        },
        create: {
          id: b.id,
          versionType: b.type,
          releaseTime: new Date(b.time),
          pistonUrl: `https://piston-meta.mojang.com/v1/packages/${b.sha1}/${b.id}.json`,
          sha1Hash: b.sha1,
          isPublished: true,
        },
      });

      await prisma.minecraftVersionMetadata.upsert({
        where: { versionId: b.id },
        update: { minJavaVersion: b.java },
        create: {
          versionId: b.id,
          minJavaVersion: b.java,
          mainClass: 'net.minecraft.client.main.Main',
          assetIndexId: b.id,
          requiredLibraries: [],
        },
      });

      count++;
    }

    return count;
  }

  private async invalidateVersionCaches() {
    const keys = [
      'cache:minecraft:versions:all:50:0',
      'cache:minecraft:versions:release:50:0',
      'cache:minecraft:versions:snapshot:50:0',
    ];
    for (const k of keys) {
      await redisService.del(k);
    }
  }
}

export const minecraftService = new MinecraftService();
