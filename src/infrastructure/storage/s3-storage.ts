import { HeadBucketCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { getStorageConfig } from "../../config/storage.config.js";
import type { WatchboxLogger } from "../../common/utils/logger.js";

export type ObjectStorageClient = S3Client;

export const createObjectStorageClient = (logger: WatchboxLogger): ObjectStorageClient => {
  const config = getStorageConfig();
  const clientConfig: S3ClientConfig = {
    region: config.region,
    forcePathStyle: config.provider !== "s3",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  };

  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
  }

  logger.info({ provider: config.provider, bucket: config.bucket }, "Object storage configured");
  return new S3Client(clientConfig);
};

export const checkObjectBucket = async (client: ObjectStorageClient): Promise<boolean> => {
  await client.send(new HeadBucketCommand({ Bucket: getStorageConfig().bucket }));
  return true;
};
