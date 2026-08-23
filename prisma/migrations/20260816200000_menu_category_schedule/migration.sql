-- Denní okno viditelnosti kategorie menu (Evropa/Praha). Bez řádku = viditelná pořád.
CREATE TABLE "MenuCategorySchedule" (
    "restaurantId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "visibleFrom" TEXT NOT NULL,
    "visibleUntil" TEXT NOT NULL,
    "updatedAtIso" TEXT NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "MenuCategorySchedule_pkey" PRIMARY KEY ("restaurantId","categoryKey")
);

ALTER TABLE "MenuCategorySchedule" ADD CONSTRAINT "MenuCategorySchedule_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuCategorySchedule" ADD CONSTRAINT "MenuCategorySchedule_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
