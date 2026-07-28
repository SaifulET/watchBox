import { getEnv } from "./env.js";

export const getStorageConfig = () => {
  const env = getEnv();
  return {
    provider: env.STORAGE_PROVIDER,
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY
  };
};
