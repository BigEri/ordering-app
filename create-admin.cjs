const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

async function main() {
  const prisma = new PrismaClient();

  const email = process.env.ADMIN_EMAIL;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!email) throw new Error("Missing ADMIN_EMAIL env var");
  if (!passwordHash) throw new Error("Missing ADMIN_PASSWORD_HASH env var");
  const nowIso = new Date().toISOString();

  const u = await prisma.user.upsert({
    where: { email },
    create: {
      id: crypto.randomUUID(),
      email,
      passwordHash,
      globalRole: "SUPER_ADMIN",
      createdAtIso: nowIso,
    },
    update: { passwordHash, globalRole: "SUPER_ADMIN" },
  });

  console.log("OK", u.email);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
