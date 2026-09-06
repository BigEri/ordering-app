-- Štítky jídel (vegan / doporučené / populární) jako úprava v Tableflow.
CREATE TABLE "MenuItemBadge" (
    "restaurantId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "badgesJson" TEXT NOT NULL,
    "updatedAtIso" TEXT NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "MenuItemBadge_pkey" PRIMARY KEY ("restaurantId","menuItemId")
);

ALTER TABLE "MenuItemBadge" ADD CONSTRAINT "MenuItemBadge_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuItemBadge" ADD CONSTRAINT "MenuItemBadge_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
