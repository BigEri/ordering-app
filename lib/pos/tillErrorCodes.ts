/** Žádost o účet bez otevřeného účtu na stole — host zatím nic nemá na účtu. */
export const BILL_EMPTY_CODE = "BILL_EMPTY";

export type TillErrorCode = typeof BILL_EMPTY_CODE;

export function tillErrorCodeFromBody(body: unknown): TillErrorCode | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const rec = body as Record<string, unknown>;
  for (const key of ["till", "storyous", "dotykacka"] as const) {
    const nested = rec[key];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    if ((nested as Record<string, unknown>).code === BILL_EMPTY_CODE) return BILL_EMPTY_CODE;
  }
  return rec.code === BILL_EMPTY_CODE ? BILL_EMPTY_CODE : undefined;
}
