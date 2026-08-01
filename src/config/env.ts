import { config as loadDotenv } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

expand(loadDotenv());

const optionalEnvString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const optionalEnvUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());
const optionalEnvEmail = z.preprocess((value) => (value === "" ? undefined : value), z.string().email().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().startsWith("/").default("/api/v1"),
  MONGODB_URI: z.string().min(1).default("mongodb://localhost:27017/watchbox"),
  MONGODB_DATABASE: z.string().min(1).default("watchbox"),
  REDIS_URL: z.string().url(),
  RABBITMQ_URL: z.string().min(1),
  RABBITMQ_DOMAIN_EXCHANGE: z.string().default("watchbox.domain"),
  RABBITMQ_JOB_EXCHANGE: z.string().default("watchbox.jobs"),
  RABBITMQ_DEAD_LETTER_EXCHANGE: z.string().default("watchbox.dead-letter"),
  JWT_CUSTOMER_ACCESS_SECRET: z.string().min(32).default("dev-customer-access-secret-32-bytes-min"),
  JWT_CUSTOMER_REFRESH_SECRET: z.string().min(32).default("dev-customer-refresh-secret-32-bytes"),
  JWT_ADMIN_ACCESS_SECRET: z.string().min(32).default("dev-admin-access-secret-32-bytes-min"),
  JWT_ADMIN_REFRESH_SECRET: z.string().min(32).default("dev-admin-refresh-secret-32-bytes"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  STORAGE_PROVIDER: z.enum(["s3", "minio", "local"]).default("local"),
  S3_ENDPOINT: optionalEnvUrl,
  S3_BUCKET: z.string().default("watchbox-local"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().default("watchbox"),
  S3_SECRET_ACCESS_KEY: z.string().default("watchbox-secret"),
  ATLAS_SEARCH_INDEX: z.string().default("listings_search"),
  ATLAS_VECTOR_INDEX: z.string().default("listing_embeddings_vector"),
  EBAY_CLIENT_ID: optionalEnvString,
  EBAY_CLIENT_SECRET: optionalEnvString,
  EBAY_REDIRECT_URI: optionalEnvUrl,
  EBAY_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  EBAY_MARKETPLACE_ID: z.string().default("EBAY_US"),
  STRIPE_SECRET_KEY: optionalEnvString,
  STRIPE_WEBHOOK_SECRET: optionalEnvString,
  EMAIL_PROVIDER: z.enum(["local", "smtp", "ses", "sendgrid", "mailgun"]).default("local"),
  EMAIL_FROM: z.string().email().default("no-reply@watchbox.local"),
  EMAIL_API_KEY: optionalEnvString,
  SMTP_HOST: optionalEnvString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: optionalEnvString,
  SMTP_PASSWORD: optionalEnvString,
  WEB_APP_URL: z.string().url().default("http://localhost:3000"),
  FCM_PROJECT_ID: optionalEnvString,
  FCM_CLIENT_EMAIL: optionalEnvEmail,
  FCM_PRIVATE_KEY: optionalEnvString,
  AI_PROVIDER: z.enum(["local", "http"]).default("local"),
  AI_SERVICE_URL: optionalEnvUrl,
  AI_SERVICE_TOKEN: optionalEnvString,
  AI_MODEL: z.string().default("gpt-5.6"),
  AI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  ENCRYPTION_KEY: z.string().min(32).default("dev-encryption-key-32-bytes-minimum")
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export const getEnv = (): Env => {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
};

export const resetEnvForTests = (): void => {
  cachedEnv = undefined;
};
