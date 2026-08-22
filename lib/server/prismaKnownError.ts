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
