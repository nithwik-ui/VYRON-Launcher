import { z } from 'zod';

export const listNewsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().max(32).optional(),
  featured: z.preprocess((val) => {
    if (typeof val === 'string') {
      return val.toLowerCase() === 'true';
    }
    return val;
  }, z.boolean().optional()),
});

export const getNewsBySlugParamSchema = z.object({
  slug: z.string().min(1).max(128),
});

export const createCategorySchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1).max(64),
  description: z.string().optional(),
  displayOrder: z.number().int().default(0),
});

export const createArticleSchema = z.object({
  slug: z.string().min(1).max(128),
  title: z.string().min(1).max(255),
  summary: z.string().min(1),
  bodyMarkdown: z.string().min(1),
  coverImageUrl: z.string().url().max(512).optional(),
  categoryId: z.string().min(1).max(32),
  authorName: z.string().min(1).max(64).default('VYRON Team'),
  status: z.enum(['DRAFT', 'REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
  isFeatured: z.boolean().default(false),
  publishedAt: z.coerce.date().optional(),
});

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(128),
  message: z.string().min(1),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL', 'MAINTENANCE']).default('INFO'),
  actionUrl: z.string().url().max(512).optional(),
  startAt: z.coerce.date().default(() => new Date()),
  endAt: z.coerce.date().default(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  isActive: z.boolean().default(true),
});

export type ListNewsQuery = z.infer<typeof listNewsQuerySchema>;
export type GetNewsBySlugParam = z.infer<typeof getNewsBySlugParamSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
