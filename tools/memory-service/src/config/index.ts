import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().default(20),
  DATABASE_SSL: z.coerce.boolean().default(false),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_KEY_PREFIX: z.string().default('egce:'),

  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Authentication
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Sync
  SYNC_ENABLED: z.coerce.boolean().default(true),
  SYNC_DEBOUNCE_MS: z.coerce.number().default(500),

  // WebSocket
  WS_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(30000),
  WS_HEARTBEAT_TIMEOUT_MS: z.coerce.number().default(60000),
  WS_MAX_RECONNECT_ATTEMPTS: z.coerce.number().default(5),
  WS_EVENT_RETENTION_DAYS: z.coerce.number().default(7),
  WS_MAX_EVENT_BATCH_SIZE: z.coerce.number().default(100),
  WS_CONFLICT_RESOLUTION: z.enum(['last_write_wins', 'first_write_wins', 'manual', 'merge']).default('last_write_wins'),
});

type EnvConfig = z.infer<typeof envSchema>;

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();

export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
