import {
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageConfig } from "../../config/storage.config.js";
import type { WatchboxLogger } from "../../common/utils/logger.js";

export type ObjectStorageClient = S3Client;

const encodeObjectKey = (key: string): string => key.split("/").map(encodeURIComponent).join("/");

export const createObjectStorageClient = (logger?: WatchboxLogger): ObjectStorageClient => {
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

  logger?.info({ provider: config.provider, bucket: config.bucket }, "Object storage configured");
  return new S3Client(clientConfig);
};

export const checkObjectBucket = async (client: ObjectStorageClient): Promise<boolean> => {
  await client.send(new HeadBucketCommand({ Bucket: getStorageConfig().bucket }));
  return true;
};

export const getObjectUrl = (key: string): string => {
  const config = getStorageConfig();
  const encodedKey = encodeObjectKey(key);

  if (config.provider === "local") {
    return `http://localhost:4000/internal/uploads/${encodedKey}`;
  }

  if (config.provider === "minio") {
    const endpoint = config.endpoint ?? "http://localhost:9000";
    return `${endpoint.replace(/\/+$/, "")}/${config.bucket}/${encodedKey}`;
  }

  if (config.endpoint) {
    return `${config.endpoint.replace(/\/+$/, "")}/${encodedKey}`;
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encodedKey}`;
};

export const createPresignedPutUrl = async (input: {
  key: string;
  contentType: string;
  expiresInSeconds: number;
}): Promise<string> => {
  const config = getStorageConfig();
  const client = createObjectStorageClient();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    ContentType: input.contentType
  });

  return getSignedUrl(client, command, { expiresIn: input.expiresInSeconds });
};

export const uploadObject = async (input: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> => {
  const config = getStorageConfig();
  const client = createObjectStorageClient();
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType
    })
  );
  return getObjectUrl(input.key);
};

export const assertObjectExists = async (key: string): Promise<void> => {
  const config = getStorageConfig();
  const client = createObjectStorageClient();
  await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
};
