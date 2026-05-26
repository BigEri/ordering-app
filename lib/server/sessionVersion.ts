import type { SessionPayload } from "./sessionToken";
import { prisma } from "./prisma";

export async function getUserSessionVersion(userId: string): Promise<number> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  return row?.sessionVersion ?? 0;
}

export async function bumpUserSessionVersion(userId: string): Promise<number> {
  const row = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return row.sessionVersion;
}

export async function assertSessionVersion(session: SessionPayload): Promise<void> {
  const dbSv = await getUserSessionVersion(session.userId);
  const tokenSv = typeof session.sv === "number" ? session.sv : 0;
  if (tokenSv !== dbSv) throw new Error("SESSION_REVOKED");
}
