import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { resetEnvForTests } from "../../src/config/env.js";
import {
  getObjectUrl,
  getReadableObjectUrl,
  normalizeObjectKey,
  objectKeyFromInternalUploadUrl,
  resolveStoredObjectUrl,
  uploadObject
} from "../../src/infrastructure/storage/s3-storage.js";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

const originalEnv = {
  storageProvider: process.env.STORAGE_PROVIDER,
  publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  localUploadDir: process.env.LOCAL_UPLOAD_DIR,
  apiPublicUrl: process.env.API_PUBLIC_URL,
  s3Endpoint: process.env.S3_ENDPOINT,
  s3Bucket: process.env.S3_BUCKET,
  s3Region: process.env.S3_REGION,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY
};

const restoreEnvValue = (name: string, value: string | undefined): void => {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
};

const restoreEnv = (): void => {
  restoreEnvValue("STORAGE_PROVIDER", originalEnv.storageProvider);
  restoreEnvValue("S3_PUBLIC_BASE_URL", originalEnv.publicBaseUrl);
  restoreEnvValue("LOCAL_UPLOAD_DIR", originalEnv.localUploadDir);
  restoreEnvValue("API_PUBLIC_URL", originalEnv.apiPublicUrl);
  restoreEnvValue("S3_ENDPOINT", originalEnv.s3Endpoint);
  restoreEnvValue("S3_BUCKET", originalEnv.s3Bucket);
  restoreEnvValue("S3_REGION", originalEnv.s3Region);
  restoreEnvValue("S3_ACCESS_KEY_ID", originalEnv.s3AccessKeyId);
  restoreEnvValue("S3_SECRET_ACCESS_KEY", originalEnv.s3SecretAccessKey);
  resetEnvForTests();
};

describe("object storage URLs", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("strips trailing dots from object keys", () => {
    expect(normalizeObjectKey("listings/abc/images/watch.jpg.")).toBe("listings/abc/images/watch.jpg");
  });

  it("extracts keys from malformed internal upload URLs", () => {
    expect(
      objectKeyFromInternalUploadUrl(
        "https://api.mywatchbox.net/internal/uploads/listings/abc/images/watch.jpg."
      )
    ).toBe("listings/abc/images/watch.jpg");
  });

  it("builds virtual-hosted S3 URLs instead of the API host", () => {
    process.env.STORAGE_PROVIDER = "s3";
    process.env.API_PUBLIC_URL = "http://localhost:4000";
    process.env.S3_BUCKET = "watchboxmarketplace";
    process.env.S3_REGION = "us-east-1";
    delete process.env.S3_PUBLIC_BASE_URL;
    delete process.env.S3_ENDPOINT;
    resetEnvForTests();

    expect(getObjectUrl("listings/abc/images/watch.jpg.")).toBe(
      "https://watchboxmarketplace.s3.us-east-1.amazonaws.com/listings/abc/images/watch.jpg"
    );
  });

  it("returns a short S3 object URL without query parameters", async () => {
    process.env.STORAGE_PROVIDER = "s3";
    process.env.API_PUBLIC_URL = "http://localhost:4000";
    process.env.S3_BUCKET = "watchboxmarketplace";
    process.env.S3_REGION = "us-east-1";
    delete process.env.S3_PUBLIC_BASE_URL;
    delete process.env.S3_ENDPOINT;
    resetEnvForTests();

    await expect(getReadableObjectUrl("listings/abc/images/watch.jpg")).resolves.toBe(
      "https://watchboxmarketplace.s3.us-east-1.amazonaws.com/listings/abc/images/watch.jpg"
    );
  });

  it("uses CloudFront when S3_PUBLIC_BASE_URL is set", () => {
    process.env.STORAGE_PROVIDER = "s3";
    process.env.S3_PUBLIC_BASE_URL = "https://cdn.mywatchbox.net";
    resetEnvForTests();

    expect(getObjectUrl("listings/abc/images/watch.jpg")).toBe(
      "https://cdn.mywatchbox.net/listings/abc/images/watch.jpg"
    );
  });

  it("rewrites stored local proxy URLs from the object key", async () => {
    process.env.STORAGE_PROVIDER = "s3";
    process.env.API_PUBLIC_URL = "http://localhost:4000";
    process.env.S3_PUBLIC_BASE_URL = "https://cdn.mywatchbox.net";
    resetEnvForTests();

    await expect(
      resolveStoredObjectUrl(
        "listings/abc/images/watch.jpg",
        "http://localhost:4000/internal/uploads/listings/abc/images/watch.jpg."
      )
    ).resolves.toBe("https://cdn.mywatchbox.net/listings/abc/images/watch.jpg");
  });
});

describe("local object storage serving", () => {
  let uploadDir = "";

  beforeEach(async () => {
    uploadDir = await mkdtemp(path.join(tmpdir(), "watchbox-uploads-"));
    process.env.STORAGE_PROVIDER = "local";
    process.env.LOCAL_UPLOAD_DIR = uploadDir;
    process.env.API_PUBLIC_URL = "http://localhost:4000";
    delete process.env.S3_PUBLIC_BASE_URL;
    resetEnvForTests();
  });

  afterEach(async () => {
    restoreEnv();
    await rm(uploadDir, { recursive: true, force: true });
  });

  it("persists a local upload and serves it from /internal/uploads", async () => {
    const key = "listings/6ad5dd82024bc72a0ca090d3/images/c328c396-eee4-430f-9862-452d8876a954.jpg";
    const url = await uploadObject({
      key,
      body: png,
      contentType: "image/jpeg"
    });

    expect(url).toBe(`http://localhost:4000/internal/uploads/${key}`);

    const app = createApp();
    const response = await request(app).get(`/internal/uploads/${key}`).expect(200);
    expect(response.headers["content-type"]).toMatch(/^image\/jpeg/);
    expect(Buffer.from(response.body).equals(png)).toBe(true);

    const trailingDotResponse = await request(app).get(`/internal/uploads/${key}.`).expect(200);
    expect(trailingDotResponse.headers["content-type"]).toMatch(/^image\/jpeg/);
  });
});
