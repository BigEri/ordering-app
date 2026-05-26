import { afterEach, describe, expect, it } from "vitest";

import {
  getObjectStorageConfig,
  isManagedObjectStorageUrl,
  objectKeyFromPublicUrl,
  publicUrlForObjectKey,
  resetObjectStorageCacheForTests,
} from "./objectStorage";

describe("objectStorage", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
    resetObjectStorageCacheForTests();
  });

  it("builds public URL from key when configured", () => {
    resetObjectStorageCacheForTests();
    process.env.S3_BUCKET = "b";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";
    process.env.S3_PUBLIC_URL_BASE = "https://cdn.example.com";

    expect(publicUrlForObjectKey("menu/r1/a.webp")).toBe("https://cdn.example.com/menu/r1/a.webp");
  });

  it("detects managed URLs on same origin", () => {
    resetObjectStorageCacheForTests();
    process.env.S3_BUCKET = "b";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";
    process.env.S3_PUBLIC_URL_BASE = "https://cdn.example.com";

    const url = "https://cdn.example.com/welcome/r1/x.webp";
    expect(isManagedObjectStorageUrl(url)).toBe(true);
    expect(objectKeyFromPublicUrl(url)).toBe("welcome/r1/x.webp");
    expect(isManagedObjectStorageUrl("https://evil.com/menu/x.webp")).toBe(false);
  });

  it("returns null config when incomplete env", () => {
    resetObjectStorageCacheForTests();
    delete process.env.S3_BUCKET;
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";
    process.env.S3_PUBLIC_URL_BASE = "https://cdn.example.com";
    expect(getObjectStorageConfig()).toBeNull();
  });

  it("requires S3_ENDPOINT when public base is R2 dev URL", () => {
    resetObjectStorageCacheForTests();
    process.env.S3_BUCKET = "b";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";
    process.env.S3_PUBLIC_URL_BASE = "https://pub-abc.r2.dev";
    delete process.env.S3_ENDPOINT;
    expect(getObjectStorageConfig()).toBeNull();
  });

  it("enables path-style for R2 API endpoint by default", () => {
    resetObjectStorageCacheForTests();
    process.env.S3_BUCKET = "b";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";
    process.env.S3_PUBLIC_URL_BASE = "https://pub-abc.r2.dev";
    process.env.S3_ENDPOINT = "https://acc.r2.cloudflarestorage.com";
    delete process.env.S3_FORCE_PATH_STYLE;
    expect(getObjectStorageConfig()?.forcePathStyle).toBe(true);
  });
});
