import crypto from "crypto";

/** Konstantní časové porovnání řetězců (Bearer tokeny, API klíče). */
export function secureCompareStrings(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}
