import { z } from 'zod';

export const listServersQuerySchema = z.object({
  category: z.string().max(32).optional(),
  search: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createServerSchema = z.object({
  name: z.string().min(1).max(64),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(25565),
  summary: z.string().min(1),
  description: z.string().optional(),
  iconUrl: z.string().url().max(512).optional(),
  bannerUrl: z.string().url().max(512).optional(),
  websiteUrl: z.string().url().max(512).optional(),
  category: z.enum(['Survival', 'Minigames', 'RPG', 'Anarchy', 'Skyblock']).default('Survival'),
  supportedVersions: z.string().min(1).max(64).default('1.21.x'),
});

export const serverParamSchema = z.object({
  id: z.string().uuid(),
});

export type ListServersQuery = z.infer<typeof listServersQuerySchema>;
export type CreateServerInput = z.infer<typeof createServerSchema>;
export type ServerParam = z.infer<typeof serverParamSchema>;
