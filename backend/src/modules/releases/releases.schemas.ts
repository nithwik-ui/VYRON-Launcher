import { z } from 'zod';

export const checkUpdateQuerySchema = z.object({
  channel: z.enum(['STABLE', 'BETA', 'NIGHTLY']).default('STABLE'),
  versionCode: z.coerce.number().int().min(0).default(0),
});

export const createReleaseSchema = z.object({
  versionName: z.string().min(1).max(32),
  versionCode: z.number().int().min(1),
  channel: z.enum(['STABLE', 'BETA', 'NIGHTLY']).default('STABLE'),
  minAndroidSdk: z.number().int().min(21).default(21),
  downloadUrl: z.string().url().max(512),
  sha256Hash: z.string().length(64),
  fileSizeBytes: z.coerce.bigint(),
  changelogMarkdown: z.string().min(1),
  rolloutPercentage: z.number().int().min(1).max(100).default(100),
  isMandatory: z.boolean().default(false),
});

export const reportCrashSchema = z.object({
  appVersion: z.string().min(1).max(32),
  androidSdk: z.number().int().min(21).max(40),
  deviceModel: z.string().max(128).optional(),
  soc: z.string().max(128).optional(),
  minecraftVersion: z.string().max(64).optional(),
  renderer: z.string().max(64).optional(),
  loader: z.string().max(32).optional(),
  stackTrace: z.string().min(1),
  errorReason: z.string().max(255).optional(),
});

export type CheckUpdateQuery = z.infer<typeof checkUpdateQuerySchema>;
export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;
export type ReportCrashInput = z.infer<typeof reportCrashSchema>;
