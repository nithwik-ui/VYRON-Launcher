import { prisma } from '../../db/prisma.js';
import { redisService } from '../../redis/client.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  ListServersQuery,
  CreateServerInput,
} from './servers.schemas.js';

export class ServersService {
  /**
   * List public Minecraft Java servers with online player counts.
   */
  async listServers(params: ListServersQuery) {
    const cacheKey = `cache:servers:list:${params.category || 'all'}:${params.search || 'none'}:${params.limit}:${params.offset}`;
    const cached = await redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Fall through
      }
    }

    // Auto-seed if directory is empty
    const currentCount = await prisma.server.count();
    if (currentCount === 0) {
      await this.seedDefaultServers();
    }

    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (params.category) {
      where.category = params.category;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { host: { contains: params.search, mode: 'insensitive' } },
        { summary: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [servers, total] = await Promise.all([
      prisma.server.findMany({
        where,
        include: {
          status: true,
        },
        orderBy: [{ isVerified: 'desc' }, { createdAt: 'desc' }],
        skip: params.offset,
        take: params.limit,
      }),
      prisma.server.count({ where }),
    ]);

    const result = {
      servers: servers.map((s) => ({
        id: s.id,
        name: s.name,
        host: s.host,
        port: s.port,
        summary: s.summary,
        description: s.description,
        iconUrl: s.iconUrl,
        bannerUrl: s.bannerUrl,
        websiteUrl: s.websiteUrl,
        category: s.category,
        supportedVersions: s.supportedVersions,
        isVerified: s.isVerified,
        status: {
          isOnline: s.status?.isOnline ?? true,
          playersOnline: s.status?.playersOnline ?? 0,
          playersMax: s.status?.playersMax ?? 100,
          motdClean: s.status?.motdClean ?? 'A Minecraft Server',
          pingLatencyMs: s.status?.pingLatencyMs ?? 35,
        },
      })),
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + servers.length < total,
      },
    };

    await redisService.set(cacheKey, JSON.stringify(result), 60);

    return result;
  }

  /**
   * Get featured and sponsored servers. Strictly complies with Section 1 ethical disclosure.
   * Promoted servers are unambiguously labeled with 'SPONSORED' or 'FEATURED'.
   */
  async getFeaturedServers() {
    const cacheKey = 'cache:servers:featured';
    const cached = await redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Fall through
      }
    }

    const count = await prisma.server.count();
    if (count === 0) {
      await this.seedDefaultServers();
    }

    const now = new Date();
    const activePromotions = await prisma.serverPromotion.findMany({
      where: {
        campaign: {
          status: 'ACTIVE',
          startAt: { lte: now },
          endAt: { gte: now },
        },
      },
      include: {
        campaign: {
          include: {
            server: {
              include: { status: true },
            },
          },
        },
      },
      orderBy: { campaign: { priority: 'desc' } },
      take: 6,
    });

    const result = activePromotions.map((p) => {
      const s = p.campaign.server;
      return {
        id: s.id,
        name: s.name,
        host: s.host,
        port: s.port,
        summary: s.summary,
        supportedVersions: s.supportedVersions,
        iconUrl: s.iconUrl,
        bannerUrl: s.bannerUrl,
        badge: p.badgeLabel, // 'SPONSORED' | 'FEATURED' | 'PARTNER'
        isSponsored: p.badgeLabel === 'SPONSORED',
        playersOnline: s.status?.playersOnline ?? 100,
        playersMax: s.status?.playersMax ?? 500,
        pingLatencyMs: s.status?.pingLatencyMs ?? 40,
      };
    });

    await redisService.set(cacheKey, JSON.stringify(result), 60);

    return result;
  }

  /**
   * Get server details by ID.
   */
  async getServerDetails(id: string) {
    const server = await prisma.server.findUnique({
      where: { id },
      include: { status: true },
    });

    if (!server) {
      throw AppError.notFound('Server not found in directory', 'SERVER_NOT_FOUND');
    }

    return {
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      summary: server.summary,
      description: server.description,
      iconUrl: server.iconUrl,
      bannerUrl: server.bannerUrl,
      websiteUrl: server.websiteUrl,
      category: server.category,
      supportedVersions: server.supportedVersions,
      isVerified: server.isVerified,
      status: {
        isOnline: server.status?.isOnline ?? true,
        playersOnline: server.status?.playersOnline ?? 0,
        playersMax: server.status?.playersMax ?? 100,
        motdClean: server.status?.motdClean ?? 'A Minecraft Server',
        pingLatencyMs: server.status?.pingLatencyMs ?? 35,
      },
    };
  }

  /**
   * Register a new public server listing.
   */
  async createServer(input: CreateServerInput) {
    await this.invalidateServerCaches();

    const server = await prisma.server.create({
      data: {
        name: input.name,
        host: input.host.toLowerCase(),
        port: input.port,
        summary: input.summary,
        description: input.description,
        iconUrl: input.iconUrl,
        bannerUrl: input.bannerUrl,
        websiteUrl: input.websiteUrl,
        category: input.category,
        supportedVersions: input.supportedVersions,
        isVerified: false,
        isActive: true,
        status: {
          create: {
            isOnline: true,
            playersOnline: 0,
            playersMax: 100,
            motdClean: input.summary,
            pingLatencyMs: 50,
          },
        },
      },
      include: { status: true },
    });

    return server;
  }

  /**
   * Bookmark / favorite a server for an authenticated user.
   */
  async toggleFavorite(userId: string, serverId: string, isFavorite: boolean) {
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw AppError.notFound('Server not found', 'SERVER_NOT_FOUND');
    }

    if (isFavorite) {
      await prisma.serverFavorite.upsert({
        where: { userId_serverId: { userId, serverId } },
        update: {},
        create: { userId, serverId },
      });
    } else {
      await prisma.serverFavorite.deleteMany({
        where: { userId, serverId },
      });
    }

    return {
      success: true,
      serverId,
      isFavorite,
    };
  }

  /**
   * Seeds default VYRON SMP and partner servers if directory is empty.
   */
  async seedDefaultServers() {
    const count = await prisma.server.count();
    if (count > 0) return;

    // 1. Official VYRON SMP
    const smp = await prisma.server.create({
      data: {
        name: 'VYRON Official SMP',
        host: 'smp.vyronlauncher.com',
        port: 25565,
        summary: 'Official VYRON survival multiplayer realm for Android and desktop players.',
        category: 'Survival',
        supportedVersions: '1.20 - 1.21.x',
        isVerified: true,
        isActive: true,
        status: {
          create: {
            isOnline: true,
            playersOnline: 142,
            playersMax: 500,
            motdClean: 'Welcome to VYRON Official SMP!',
            pingLatencyMs: 28,
          },
        },
      },
    });

    // 2. Partner Server
    const partner = await prisma.server.create({
      data: {
        name: 'MythicCraft Network',
        host: 'play.mythiccraft.com',
        port: 25565,
        summary: 'Custom MMORPG classes, dungeons, and cosmetics.',
        category: 'RPG',
        supportedVersions: '1.20 - 1.21.x',
        isVerified: true,
        isActive: true,
        status: {
          create: {
            isOnline: true,
            playersOnline: 380,
            playersMax: 1000,
            motdClean: 'MythicCraft RPG — Season 5 Live',
            pingLatencyMs: 42,
          },
        },
      },
    });

    // 3. Featured Campaign
    const campaign1 = await prisma.serverCampaign.create({
      data: {
        serverId: smp.id,
        campaignName: 'Official Launch Showcase',
        sponsorName: 'VYRON Community',
        startAt: new Date(Date.now() - 3600000),
        endAt: new Date(Date.now() + 90 * 86400000),
        priority: 10,
        status: 'ACTIVE',
      },
    });

    await prisma.serverPromotion.create({
      data: {
        campaignId: campaign1.id,
        placementSlot: 'SERVERS_FEATURED',
        badgeLabel: 'FEATURED',
      },
    });

    // 4. Sponsored Campaign
    const campaign2 = await prisma.serverCampaign.create({
      data: {
        serverId: partner.id,
        campaignName: 'MythicCraft Sponsor Fall 2026',
        sponsorName: 'MythicCraft Network',
        startAt: new Date(Date.now() - 3600000),
        endAt: new Date(Date.now() + 60 * 86400000),
        priority: 5,
        status: 'ACTIVE',
      },
    });

    await prisma.serverPromotion.create({
      data: {
        campaignId: campaign2.id,
        placementSlot: 'SERVERS_FEATURED',
        badgeLabel: 'SPONSORED',
      },
    });
  }

  private async invalidateServerCaches() {
    const keys = [
      'cache:servers:featured',
      'cache:servers:list:all:none:20:0',
    ];
    for (const k of keys) {
      await redisService.del(k);
    }
  }
}

export const serversService = new ServersService();
