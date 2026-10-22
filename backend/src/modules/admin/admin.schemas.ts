import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  totpCode: z.string().length(6).regex(/^\d{6}$/).optional(),
});

export const verifyTotpSchema = z.object({
  totpCode: z.string().length(6).regex(/^\d{6}$/),
});

export const assignRoleSchema = z.object({
  role: z.enum([
    'SUPER_ADMIN',
    'CONTENT_ADMIN',
    'SERVER_ADMIN',
    'RELEASE_ADMIN',
    'MODERATOR',
    'SUPPORT_ADMIN',
    'ANALYTICS',
    'USER',
  ]),
});

export const updateArticleAdminSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  summary: z.string().min(1).optional(),
  bodyMarkdown: z.string().min(1).optional(),
  coverImageUrl: z.string().url().max(512).optional(),
  categoryId: z.string().min(1).max(32).optional(),
  status: z.enum(['DRAFT', 'REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).optional(),
  isFeatured: z.boolean().optional(),
});

export const queryAuditLogsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type VerifyTotpInput = z.infer<typeof verifyTotpSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type UpdateArticleAdminInput = z.infer<typeof updateArticleAdminSchema>;
export type QueryAuditLogsInput = z.infer<typeof queryAuditLogsSchema>;
