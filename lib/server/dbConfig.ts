/** Validates DATABASE_URL early so deploy misconfig shows a clear message in logs/UI. */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL. Add a Postgres connection string in Vercel → Settings → Environment Variables (e.g. from Neon). Then redeploy and run: npx prisma migrate deploy",
    );
  }
  return url;
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
