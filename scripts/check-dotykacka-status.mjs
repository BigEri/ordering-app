import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    select: {
      id: true,
      name: true,
      dotykacka: {
        select: {
          cloudId: true,
          branchId: true,
          lastOkAtIso: true,
          lastError: true,
          disabled: true,
        },
      },
    },
  });
  console.log("restaurants:");
  for (const r of restaurants) {
    const d = r.dotykacka;
    console.log(`- ${r.name}`);
    if (!d) {
      console.log("  dotykacka: NOT CONNECTED");
      continue;
    }
    console.log(`  cloud=${d.cloudId} branch=${d.branchId} disabled=${d.disabled}`);
    console.log(`  lastOk=${d.lastOkAtIso ?? "—"}`);
    if (d.lastError) console.log(`  lastError=${d.lastError.slice(0, 200)}`);
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
