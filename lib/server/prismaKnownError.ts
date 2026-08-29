/** Prisma `error.code` without importing the full Prisma runtime in tests. */
export function prismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if (!("code" in error) || typeof error.code !== "string") return null;
  return error.code;
}

/** Column in Prisma schema is missing from the live database (migrate not applied). */
export function isPrismaMissingColumnError(error: unknown): boolean {
  return prismaErrorCode(error) === "P2022";
}

/** Table in Prisma schema is missing from the live database (migrate not applied). */
export function isPrismaMissingTableError(error: unknown): boolean {
  return prismaErrorCode(error) === "P2021";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "";
}

/**
 * Neon / serverless: spojení v poolu umře (idle po HTTP k pokladně) — P1017
 * „Server has closed the connection“, timeout poolu, dočasně nedostupný host.
 */
export function isPrismaTransientConnectionError(error: unknown): boolean {
  const code = prismaErrorCode(error);
  if (code === "P1017" || code === "P1001" || code === "P1002" || code === "P1011" || code === "P2024") {
    return true;
  }
  const msg = errorMessage(error);
  return /server has closed the connection|timed out fetching a new connection|can't reach database server|connection reset/i.test(
    msg,
  );
}
