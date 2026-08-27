-- Pořád u sekce: alwaysVisible=1, časy volitelné. Bez řádku = základní nabídka (schová se při časovém menu).
ALTER TABLE "MenuCategorySchedule" ADD COLUMN "alwaysVisible" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MenuCategorySchedule" ALTER COLUMN "visibleFrom" DROP NOT NULL;
ALTER TABLE "MenuCategorySchedule" ALTER COLUMN "visibleUntil" DROP NOT NULL;
