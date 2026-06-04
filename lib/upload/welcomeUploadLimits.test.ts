import { describe, expect, it } from "vitest";

import {
  isWelcomeUploadTooLarge,
  messageFromWelcomeUploadFailure,
  welcomeFileTooLargeMessage,
  WELCOME_UPLOAD_MAX_BYTES,
} from "./welcomeUploadLimits";

describe("welcomeUploadLimits", () => {
  it("detects oversize files", () => {
    expect(isWelcomeUploadTooLarge(WELCOME_UPLOAD_MAX_BYTES + 1)).toBe(true);
    expect(isWelcomeUploadTooLarge(1024)).toBe(false);
  });

  it("413 maps to too large message", () => {
    const msg = messageFromWelcomeUploadFailure(
      new Response("", { status: 413 }),
      "",
      WELCOME_UPLOAD_MAX_BYTES + 1000,
    );
    expect(msg).toContain("příliš velký");
  });

  it("parses JSON error body", () => {
    const msg = messageFromWelcomeUploadFailure(
      new Response("", { status: 400 }),
      JSON.stringify({ error: "Soubor je příliš velký (max. 10 MB)." }),
    );
    expect(msg).toContain("10 MB");
  });

  it("includes file size in client message", () => {
    expect(welcomeFileTooLargeMessage(12 * 1024 * 1024)).toMatch(/12 MB/);
  });
});
