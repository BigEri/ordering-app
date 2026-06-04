import { afterEach, describe, expect, it } from "vitest";

import { resetObjectStorageCacheForTests } from "./objectStorage";
import { isAllowedWelcomeImageUrl } from "./welcomeImageStorage";

describe("isAllowedWelcomeImageUrl", () => {
  const env = { ...process.env };
  const rid = "aaddec79-9b61-424b-acc6-455d73a379ec";

  afterEach(() => {
    process.env = { ...env };
    resetObjectStorageCacheForTests();
  });

  it("allows R2 menu image URL for same restaurant", () => {
    resetObjectStorageCacheForTests();
    process.env.S3_BUCKET = "b";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";
    process.env.S3_PUBLIC_URL_BASE = "https://pub-b7e59f35c0774c3cb10f5811e19a6c9e.r2.dev";

    const url = `https://pub-b7e59f35c0774c3cb10f5811e19a6c9e.r2.dev/menu/${rid}/photo.webp`;
    expect(isAllowedWelcomeImageUrl(url, rid)).toBe(true);
  });

  it("allows R2 welcome path for same restaurant", () => {
    resetObjectStorageCacheForTests();
    process.env.S3_BUCKET = "b";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";
    process.env.S3_PUBLIC_URL_BASE = "https://cdn.example.com";

    expect(isAllowedWelcomeImageUrl(`https://cdn.example.com/welcome/${rid}/x.webp`, rid)).toBe(true);
  });

  it("rejects R2 menu URL for different restaurant", () => {
    resetObjectStorageCacheForTests();
    process.env.S3_BUCKET = "b";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";
    process.env.S3_PUBLIC_URL_BASE = "https://cdn.example.com";

    expect(isAllowedWelcomeImageUrl(`https://cdn.example.com/menu/other-rid/x.webp`, rid)).toBe(false);
  });

  it("allows local menu upload path", () => {
    expect(isAllowedWelcomeImageUrl(`/uploads/menu/${rid}/x.webp`, rid)).toBe(true);
  });
});
