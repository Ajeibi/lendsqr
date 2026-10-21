import * as Joi from 'joi';

/**
 * The app refuses to boot if the environment is incomplete or malformed,
 * so a misconfigured deploy fails loudly instead of misbehaving at runtime.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  DATABASE_SSL: Joi.boolean().default(false),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).default(10),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),

  ADJUTOR_BASE_URL: Joi.string()
    .uri()
    .default('https://adjutor.lendsqr.com/v2'),
  ADJUTOR_API_KEY: Joi.string().allow('').default(''),
  ADJUTOR_TIMEOUT_MS: Joi.number().integer().min(100).default(3000),
  // When Karma is unreachable: false = refuse onboarding (safe default for a lender).
  KARMA_FAIL_OPEN: Joi.boolean().default(false),

  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60_000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),

  // Amounts are in minor units (kobo). Default cap: ₦5,000,000.
  MAX_TRANSACTION_AMOUNT: Joi.number().integer().min(1).default(500_000_000),
  IDEMPOTENCY_TTL_HOURS: Joi.number().integer().min(1).default(24),
});
