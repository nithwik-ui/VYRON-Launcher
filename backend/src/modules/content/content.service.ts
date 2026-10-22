import { prisma } from '../../db/prisma.js';
import { redisService } from '../../redis/client.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  ListNewsQuery,
  CreateCategoryInput,
  CreateArticleInput,
  CreateAnnouncementInput,
} from './content.schemas.js';

export class ContentService {
  /**
   * List published news articles with filtering, pagination, and caching.
   */
  async listPublishedNews(params: ListNewsQuery) {
    const cacheKey = `cache:news:list:${params.category || 'all'}:${params.featured ?? 'any'}:${params.limit}:${params.offset}`;
    const cached = await redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Fall through on JSON parse error
      }
    }

    const now = new Date();
    const whereClause: Record<string, unknown> = {
      status: 'PUBLISHED',
      publishedAt: { lte: now },
    };

    if (params.category) {
      whereClause.categoryId = params.category;
    }

    if (params.featured !== undefined) {
      whereClause.isFeatured = params.featured;
    }

    const [articles, total] = await Promise.all([
      prisma.newsArticle.findMany({
        where: whereClause,
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
        orderBy: { publishedAt: 'desc' },
        skip: params.offset,
        take: params.limit,
      }),
      prisma.newsArticle.count({ where: whereClause }),
    ]);

    const result = {
      articles: articles.map((article) => ({
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        coverImageUrl: article.coverImageUrl,
        category: article.category.name,
        categoryId: article.categoryId,
        authorName: article.authorName,
        isFeatured: article.isFeatured,
        publishedAt: article.publishedAt,
      })),
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + articles.length < total,
      },
    };

    // Cache in Redis for 300 seconds (5 minutes)
    await redisService.set(cacheKey, JSON.stringify(result), 300);

    return result;
  }

  /**
   * Get complete article details by slug including Markdown content.
   */
  async getNewsBySlug(slug: string) {
    const cacheKey = `cache:news:slug:${slug}`;
    const cached = await redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Fall through
      }
    }

    const article = await prisma.newsArticle.findUnique({
      where: { slug },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    if (!article || article.status !== 'PUBLISHED') {
      throw AppError.notFound(`News article with slug '${slug}' not found`, 'ARTICLE_NOT_FOUND');
    }

    const result = {
      id: article.id,
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      bodyMarkdown: article.bodyMarkdown,
      coverImageUrl: article.coverImageUrl,
      category: article.category.name,
      categoryId: article.categoryId,
      authorName: article.authorName,
      isFeatured: article.isFeatured,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
    };

    await redisService.set(cacheKey, JSON.stringify(result), 300);

    return result;
  }

  /**
   * Get active announcements and urgent alert banners.
   */
  async getActiveAnnouncements() {
    const cacheKey = 'cache:announcements:active';
    const cached = await redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Fall through
      }
    }

    const now = new Date();
    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        startAt: { lte: now },
        endAt: { gte: now },
      },
      orderBy: { startAt: 'desc' },
    });

    const result = announcements.map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      severity: item.severity,
      actionUrl: item.actionUrl,
      startAt: item.startAt,
      endAt: item.endAt,
    }));

    await redisService.set(cacheKey, JSON.stringify(result), 60);

    return result;
  }

  /**
   * Create or update a news category (Staff/Admin).
   */
  async createCategory(input: CreateCategoryInput) {
    const category = await prisma.newsCategory.upsert({
      where: { id: input.id },
      update: {
        name: input.name,
        description: input.description,
        displayOrder: input.displayOrder,
      },
      create: {
        id: input.id,
        name: input.name,
        description: input.description,
        displayOrder: input.displayOrder,
      },
    });
    return category;
  }

  /**
   * Create an article (Staff/Admin).
   */
  async createArticle(input: CreateArticleInput) {
    // Invalidate caches
    await this.invalidateNewsCaches();

    return prisma.newsArticle.create({
      data: {
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        bodyMarkdown: input.bodyMarkdown,
        coverImageUrl: input.coverImageUrl,
        categoryId: input.categoryId,
        authorName: input.authorName,
        status: input.status,
        isFeatured: input.isFeatured,
        publishedAt: input.publishedAt || (input.status === 'PUBLISHED' ? new Date() : null),
      },
    });
  }

  /**
   * Create an announcement (Staff/Admin).
   */
  async createAnnouncement(input: CreateAnnouncementInput) {
    await redisService.del('cache:announcements:active');

    return prisma.announcement.create({
      data: {
        title: input.title,
        message: input.message,
        severity: input.severity,
        actionUrl: input.actionUrl,
        startAt: input.startAt,
        endAt: input.endAt,
        isActive: input.isActive,
      },
    });
  }

  /**
   * Seeds default news categories and initial release announcement if empty.
   */
  async seedDefaultContent() {
    const categoryCount = await prisma.newsCategory.count();
    if (categoryCount === 0) {
      const defaultCategories = [
        { id: 'updates', name: 'Launcher Updates', description: 'Official releases and changelogs', displayOrder: 1 },
        { id: 'community', name: 'Community', description: 'Community highlights and spotlights', displayOrder: 2 },
        { id: 'guides', name: 'Guides & Tips', description: 'Performance and setup tutorials', displayOrder: 3 },
        { id: 'events', name: 'Events', description: 'Tournaments and community gatherings', displayOrder: 4 },
      ];

      for (const cat of defaultCategories) {
        await prisma.newsCategory.create({ data: cat });
      }
    }

    const articleCount = await prisma.newsArticle.count();
    if (articleCount === 0) {
      await prisma.newsArticle.create({
        data: {
          slug: 'vyron-launcher-v3-announcement',
          title: 'Welcome to VYRON Launcher v3 OpenJDK',
          summary: 'Experience modern desktop Minecraft: Java Edition on Android with desktop LWJGL 3 runtime, ANGLE Vulkan bridge, and isolated hardware security.',
          bodyMarkdown: `# Welcome to VYRON Launcher v3\n\nVYRON Launcher delivers true desktop Minecraft: Java Edition execution to modern mobile hardware.\n\n### Key Features\n- **Desktop OpenJDK 21 Support:** Full compatibility with modern Minecraft 1.20.5+ and 1.21.x.\n- **Vulkan Graphics Translation:** High frame-rate gaming powered by ANGLE and MobileGlues.\n- **Isolated Identity Vault:** Your Microsoft OAuth tokens remain encrypted on-device in hardware KeyStore.\n- **Customizable Touch HUD:** Responsive virtual buttons with full gamepad integration.\n\nHappy mining!`,
          coverImageUrl: 'https://cdn.vyronlauncher.com/banners/v3-launch-hero.webp',
          categoryId: 'updates',
          authorName: 'VYRON Team',
          status: 'PUBLISHED',
          isFeatured: true,
          publishedAt: new Date(),
        },
      });
    }

    const announcementCount = await prisma.announcement.count();
    if (announcementCount === 0) {
      await prisma.announcement.create({
        data: {
          title: 'VYRON v3 OpenJDK Release',
          message: 'Welcome to the official VYRON v3 OpenJDK release! Enjoy optimized 1.21.4 performance.',
          severity: 'INFO',
          actionUrl: 'https://vyronlauncher.com/changelog',
          startAt: new Date(Date.now() - 60000),
          endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      });
    }
  }

  private async invalidateNewsCaches() {
    // Deliberately purge common list cache keys
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

export const contentService = new ContentService();
