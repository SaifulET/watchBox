import { mkdir, readFile, unlink, writeFile, access } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ResourceNotFoundError } from "../../common/errors/app-error.js";
import { getEnv } from "../../config/env.js";
import { getStorageConfig } from "../../config/storage.config.js";
import type { WatchboxLogger } from "../../common/utils/logger.js";

export type ObjectStorageClient = S3Client;

export type StoredObject = {
  body: Buffer;
  contentType: string;
  contentLength: number;
};

const contentTypeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  txt: "text/plain",
  json: "application/json"
};

const encodeObjectKey = (key: string): string => key.split("/").map(encodeURIComponent).join("/");

export const normalizeObjectKey = (key: string): string =>
  key
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.+$/, "")
    .replace(/\/{2,}/g, "/");

export const assertSafeObjectKey = (key: string): string => {
  const normalized = normalizeObjectKey(key);
  if (
    !normalized ||
    normalized.split("/").some((part) => part === "." || part === ".." || part.length === 0)
  ) {
    throw new ResourceNotFoundError("Object not found.");
  }
  return normalized;
};

export const objectKeyFromInternalUploadUrl = (url: string): string | undefined => {
  const marker = "/internal/uploads/";
  const index = url.indexOf(marker);
  if (index < 0) {
    return undefined;
  }
  const rawKey = url.slice(index + marker.length);
  try {
    return normalizeObjectKey(decodeURIComponent(rawKey));
  } catch {
    return normalizeObjectKey(rawKey);
  }
};

export const resolveStoredObjectUrl = (key?: string | null, fallbackUrl?: string | null): string | null => {
  if (key && key.trim()) {
    return getObjectUrl(key);
  }
  if (!fallbackUrl) {
    return null;
  }
  const extractedKey = objectKeyFromInternalUploadUrl(fallbackUrl);
  if (extractedKey) {
    return getObjectUrl(extractedKey);
  }
  return fallbackUrl.replace(/\.+$/, "");
};

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
  const encodedKey = encodeObjectKey(assertSafeObjectKey(key));

  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/+$/, "")}/${encodedKey}`;
  }

  return `${getEnv().API_PUBLIC_URL.replace(/\/+$/, "")}/internal/uploads/${encodedKey}`;
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
    Key: assertSafeObjectKey(input.key),
    ContentType: input.contentType
  });

  return getSignedUrl(client, command, { expiresIn: input.expiresInSeconds });
};

export const uploadObject = async (input: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> => {
  const key = assertSafeObjectKey(input.key);
  const config = getStorageConfig();
  if (config.provider === "local") {
    const filePath = localObjectPath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);
    return getObjectUrl(key);
  }

  const client = createObjectStorageClient();
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: input.body,
      ContentType: input.contentType
    })
  );
  return getObjectUrl(key);
};

export const deleteObject = async (key: string): Promise<void> => {
  const config = getStorageConfig();
  const normalizedKey = assertSafeObjectKey(key);
  if (config.provider === "local") {
    try {
      await unlink(localObjectPath(normalizedKey));
    } catch {
      return;
    }
    return;
  }

  const client = createObjectStorageClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: normalizedKey
    })
  );
};

export const assertObjectExists = async (key: string): Promise<void> => {
  const config = getStorageConfig();
  const normalizedKey = assertSafeObjectKey(key);
  if (config.provider === "local") {
    try {
      await access(localObjectPath(normalizedKey));
      return;
    } catch {
      throw new ResourceNotFoundError("Uploaded object was not found in storage.");
    }
  }

  const client = createObjectStorageClient();
  await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: normalizedKey }));
};

export const readStoredObject = async (key: string): Promise<StoredObject> => {
  const config = getStorageConfig();
  const normalizedKey = assertSafeObjectKey(key);

  if (config.provider === "local") {
    try {
      const body = await readFile(localObjectPath(normalizedKey));
      return {
        body,
        contentType: contentTypeFromKey(normalizedKey),
        contentLength: body.length
      };
    } catch {
      throw new ResourceNotFoundError("Object not found.");
    }
  }

  const client = createObjectStorageClient();
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: normalizedKey
      })
    );
    const body = Buffer.from((await response.Body?.transformToByteArray()) ?? []);
    return {
      body,
      contentType: response.ContentType?.trim() || contentTypeFromKey(normalizedKey),
      contentLength: body.length
    };
  } catch (error) {
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
      throw new ResourceNotFoundError("Object not found.");
    }
    throw error;
  }
};

const contentTypeFromKey = (key: string): string => {
  const extension = key.split(".").pop()?.toLowerCase() ?? "";
  return contentTypeByExtension[extension] ?? "application/octet-stream";
};

const localObjectPath = (key: string): string => {
  const safeKey = assertSafeObjectKey(key);
  const root = path.resolve(getStorageConfig().localUploadDir);
  const fullPath = path.resolve(root, safeKey);
  const relative = path.relative(root, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ResourceNotFoundError("Object not found.");
  }
  return fullPath;
};
