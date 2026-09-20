-- Jedna provozovna = jedna pokladna. Stávající Storyous provozovny zůstanou Storyous.
ALTER TABLE "Restaurant" ADD COLUMN "pos" TEXT NOT NULL DEFAULT 'dotykacka';

UPDATE "Restaurant" AS r
SET "pos" = 'storyous'
WHERE EXISTS (
  SELECT 1
  FROM "RestaurantStoryous" AS s
  WHERE s."restaurantId" = r."id"
    AND s."disabled" = 0
    AND btrim(s."merchantId") <> ''
    AND btrim(s."placeId") <> ''
);
