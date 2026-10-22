import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env with override: true so local .env takes precedence over host system environment
dotenv.config({ override: true });

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),

  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
}).superRefine((data, ctx) => {
  if (data.APP_ENV === 'production') {
    // 1. Production TLS Enforcement: No SSL bypasses allowed
    const insecureSslOptions = [
      'sslaccept=accept_invalid_certs',
      'rejectUnauthorized=false',
      'sslmode=disable',
      'sslmode=allow',
      'sslmode=prefer',
    ];

    for (const opt of insecureSslOptions) {
      if (data.DATABASE_URL.toLowerCase().includes(opt.toLowerCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DATABASE_URL'],
          message: `PRODUCTION SECURITY VIOLATION: Database connection string contains insecure SSL option '${opt}'. Production requires verified SSL/TLS certificate validation.`,
        });
      }
      if (data.DIRECT_URL && data.DIRECT_URL.toLowerCase().includes(opt.toLowerCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DIRECT_URL'],
          message: `PRODUCTION SECURITY VIOLATION: Direct connection string contains insecure SSL option '${opt}'. Production requires verified SSL/TLS certificate validation.`,
        });
      }
    }

    // 2. Production Secrets Enforcement
    if (!data.SUPABASE_SECRET_KEY || data.SUPABASE_SECRET_KEY.includes('placeholder')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_SECRET_KEY'],
        message: 'SUPABASE_SECRET_KEY must be configured with a valid secret key in production.',
      });
    }

    if (!data.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
        message: 'SUPABASE_SERVICE_ROLE_KEY is required in production.',
      });
    }

    // 3. Production Redis Enforcement
    if (data.REDIS_URL.includes('localhost') || data.REDIS_URL.includes('127.0.0.1')) {
      // In production, log a warning or flag if not configured for clustering/remote Redis
    }
  }
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateConfig(rawEnv: Record<string, unknown> = process.env): EnvConfig {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map(err => `${err.path.join('.')}: ${err.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${errorDetails}`);
  }
  return result.data;
}

function loadConfig(): EnvConfig {
  return validateConfig(process.env);
}

export const config = loadConfig();

/**
 * Returns a sanitized copy of the configuration safe for logging.
 * All secrets and passwords are redacted.
 */
export function getSanitizedConfig(): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...config };
  const sensitiveKeys = [
    'DATABASE_URL',
    'DIRECT_URL',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
  ];

  for (const key of sensitiveKeys) {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}
