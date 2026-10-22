import { z } from 'zod';

export const listMinecraftVersionsQuerySchema = z.object({
  type: z.enum(['all', 'release', 'snapshot', 'old_beta', 'old_alpha']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const getMinecraftVersionParamSchema = z.object({
  id: z.string().min(1).max(64),
});

export const queryCompatibilitySchema = z.object({
  version: z.string().min(1).max(64),
  soc: z.string().max(128).optional().default('Generic ARM64'),
  renderer: z.enum(['ANGLE', 'Zink', 'MobileGlues', 'SFPEW']).optional().default('ANGLE'),
});

export const syncVersionsQuerySchema = z.object({
  force: z.preprocess((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return val;
  }, z.boolean().optional().default(false)),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type ListMinecraftVersionsQuery = z.infer<typeof listMinecraftVersionsQuerySchema>;
export type GetMinecraftVersionParam = z.infer<typeof getMinecraftVersionParamSchema>;
export type QueryCompatibilityInput = z.infer<typeof queryCompatibilitySchema>;
export type SyncVersionsQuery = z.infer<typeof syncVersionsQuerySchema>;
