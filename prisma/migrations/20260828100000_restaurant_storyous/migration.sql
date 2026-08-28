-- Napojení Storyous k restauraci (merchant + provozovna). Client ID/Secret zůstávají v env.
CREATE TABLE "RestaurantStoryous" (
    "restaurantId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "merchantName" TEXT,
    "placeName" TEXT,
    "disabled" INTEGER NOT NULL DEFAULT 0,
    "createdAtIso" TEXT,
    "updatedAtIso" TEXT NOT NULL,
    "lastOkAtIso" TEXT,
    "lastError" TEXT,

    CONSTRAINT "RestaurantStoryous_pkey" PRIMARY KEY ("restaurantId")
);

ALTER TABLE "RestaurantStoryous" ADD CONSTRAINT "RestaurantStoryous_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
