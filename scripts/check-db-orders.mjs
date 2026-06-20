import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$queryRaw`SELECT 1 as ok`;
  console.log("database: connected");

  const host = (() => {
    try {
      const u = new URL(process.env.DATABASE_URL ?? "");
      return u.hostname;
    } catch {
      return "unknown";
    }
  })();
  console.log("database_host:", host);
  console.log("pooled:", host.includes("-pooler"));

  const events = await prisma.integrationAuditEvent.findMany({
    where: { type: { in: ["pos_order_failed", "pos_order_sent"] } },
    orderBy: { createdAtIso: "desc" },
    take: 8,
    select: { type: true, createdAtIso: true, deviceId: true, detailsJson: true },
  });

  console.log("\nrecent_order_events:");
  for (const e of events) {
    let err = "";
    try {
      const d = JSON.parse(e.detailsJson || "{}");
      err = d.error || d.dotykacka?.error || "";
    } catch {
      /* ignore */
    }
    console.log(`- ${e.createdAtIso} ${e.type} device=${e.deviceId ?? "—"} ${err ? `error=${String(err).slice(0, 120)}` : ""}`);
  }

  const devices = await prisma.kioskDeviceBinding.findMany({
    orderBy: { tableLabel: "asc" },
    take: 10,
    select: { deviceId: true, tableLabel: true, tableId: true, restaurantId: true },
  });
  console.log("\npaired_devices:", devices.length);
  for (const d of devices) {
    console.log(`- ${d.tableLabel} (table ${d.tableId}) ${d.deviceId.slice(0, 24)}…`);
  }
}

main()
  .catch((e) => {
    console.error("database_error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
