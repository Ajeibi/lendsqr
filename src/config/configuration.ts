export interface AppConfig {
  nodeEnv: string;
  port: number;
  database: { url: string; ssl: boolean; poolMax: number };
  jwt: { secret: string; expiresIn: string };
  adjutor: {
    baseUrl: string;
    apiKey: string;
    timeoutMs: number;
    failOpen: boolean;
  };
  throttle: { ttlMs: number; limit: number };
  limits: { maxTransactionAmount: number; idempotencyTtlHours: number };
}

/** Maps validated env vars into a typed, nested config object. */
export const configuration = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV!,
  port: Number(process.env.PORT),
  database: {
    url: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_SSL === 'true',
    poolMax: Number(process.env.DATABASE_POOL_MAX),
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN!,
  },
  adjutor: {
    baseUrl: process.env.ADJUTOR_BASE_URL!,
    apiKey: process.env.ADJUTOR_API_KEY ?? '',
    timeoutMs: Number(process.env.ADJUTOR_TIMEOUT_MS),
    failOpen: process.env.KARMA_FAIL_OPEN === 'true',
  },
  throttle: {
    ttlMs: Number(process.env.THROTTLE_TTL_MS),
    limit: Number(process.env.THROTTLE_LIMIT),
  },
  limits: {
    maxTransactionAmount: Number(process.env.MAX_TRANSACTION_AMOUNT),
    idempotencyTtlHours: Number(process.env.IDEMPOTENCY_TTL_HOURS),
  },
});
