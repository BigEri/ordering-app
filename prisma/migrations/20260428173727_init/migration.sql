-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAtIso" TEXT NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppLocale" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAtIso" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AppLocale_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "UiMessage" (
    "locale" TEXT NOT NULL,
    "msgKey" TEXT NOT NULL,
    "msgValue" TEXT NOT NULL,
    "updatedAtIso" TEXT NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "UiMessage_pkey" PRIMARY KEY ("locale","msgKey")
);

-- CreateTable
CREATE TABLE "RestaurantLocale" (
    "restaurantId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL DEFAULT 1,
    "createdAtIso" TEXT NOT NULL,
    "updatedAtIso" TEXT NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "RestaurantLocale_pkey" PRIMARY KEY ("restaurantId","locale")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "globalRole" TEXT NOT NULL,
    "createdAtIso" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAtIso" TEXT NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId","restaurantId")
);

-- CreateTable
CREATE TABLE "MenuImage" (
    "restaurantId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imagePublicId" TEXT,
    "updatedAtIso" TEXT NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "MenuImage_pkey" PRIMARY KEY ("restaurantId","menuItemId")
);

-- CreateTable
CREATE TABLE "MenuItemPosition" (
    "restaurantId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "MenuItemPosition_pkey" PRIMARY KEY ("restaurantId","categoryKey","menuItemId")
);

-- CreateTable
CREATE TABLE "MenuHiddenItem" (
    "restaurantId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "hidden" INTEGER NOT NULL DEFAULT 1,
    "updatedAtIso" TEXT NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "MenuHiddenItem_pkey" PRIMARY KEY ("restaurantId","menuItemId")
);

-- CreateTable
CREATE TABLE "MenuHiddenCategory" (
    "restaurantId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "hidden" INTEGER NOT NULL DEFAULT 1,
    "updatedAtIso" TEXT NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "MenuHiddenCategory_pkey" PRIMARY KEY ("restaurantId","categoryKey")
);

-- CreateTable
CREATE TABLE "MenuTextOverride" (
    "restaurantId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "updatedAtIso" TEXT NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "MenuTextOverride_pkey" PRIMARY KEY ("restaurantId","locale","entityType","entityId")
);

-- CreateTable
CREATE TABLE "MenuIngredientOverride" (
    "restaurantId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "ingredientsJson" TEXT NOT NULL,
    "updatedAtIso" TEXT NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "MenuIngredientOverride_pkey" PRIMARY KEY ("restaurantId","locale","menuItemId")
);

-- CreateTable
CREATE TABLE "MenuDotykackaLabel" (
    "restaurantId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "updatedAtIso" TEXT NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "MenuDotykackaLabel_pkey" PRIMARY KEY ("restaurantId","locale","entityType","entityId")
);

-- CreateTable
CREATE TABLE "RestaurantDotykacka" (
    "restaurantId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "cloudId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL DEFAULT 0,
    "productMapJson" TEXT NOT NULL DEFAULT '{}',
    "apiBase" TEXT,
    "updatedAtIso" TEXT NOT NULL,
    "createdAtIso" TEXT,
    "disabled" INTEGER NOT NULL DEFAULT 0,
    "revokedAtIso" TEXT,
    "lastTokenRefreshAtIso" TEXT,
    "lastOkAtIso" TEXT,
    "lastError" TEXT,

    CONSTRAINT "RestaurantDotykacka_pkey" PRIMARY KEY ("restaurantId")
);

-- CreateTable
CREATE TABLE "IntegrationAuditEvent" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "type" TEXT NOT NULL,
    "actorUserId" TEXT,
    "deviceId" TEXT,
    "detailsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAtIso" TEXT NOT NULL,

    CONSTRAINT "IntegrationAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DotykackaOauthState" (
    "state" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAtIso" TEXT NOT NULL,
    "expiresAtIso" TEXT NOT NULL,
    "usedAtIso" TEXT,

    CONSTRAINT "DotykackaOauthState_pkey" PRIMARY KEY ("state")
);

-- CreateTable
CREATE TABLE "RestaurantWelcome" (
    "restaurantId" TEXT NOT NULL,
    "layoutPreset" TEXT NOT NULL DEFAULT 'mosaic',
    "imageUrlsJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAtIso" TEXT NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "RestaurantWelcome_pkey" PRIMARY KEY ("restaurantId")
);

-- CreateTable
CREATE TABLE "KioskDeviceBinding" (
    "deviceId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "tableLabel" TEXT NOT NULL,
    "updatedAtIso" TEXT NOT NULL,

    CONSTRAINT "KioskDeviceBinding_pkey" PRIMARY KEY ("deviceId")
);

-- CreateTable
CREATE TABLE "DevicePairingCode" (
    "code" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "createdAtIso" TEXT NOT NULL,
    "expiresAtIso" TEXT NOT NULL,
    "usedAtIso" TEXT,

    CONSTRAINT "DevicePairingCode_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "idx_restaurant_locales_locale" ON "RestaurantLocale"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "idx_integration_audit_restaurant" ON "IntegrationAuditEvent"("restaurantId", "createdAtIso");

-- CreateIndex
CREATE INDEX "idx_integration_audit_type" ON "IntegrationAuditEvent"("type", "createdAtIso");

-- CreateIndex
CREATE INDEX "idx_dotykacka_oauth_states_exp" ON "DotykackaOauthState"("expiresAtIso");

-- CreateIndex
CREATE INDEX "idx_device_pairing_device" ON "DevicePairingCode"("deviceId");

-- AddForeignKey
ALTER TABLE "UiMessage" ADD CONSTRAINT "UiMessage_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantLocale" ADD CONSTRAINT "RestaurantLocale_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantLocale" ADD CONSTRAINT "RestaurantLocale_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuImage" ADD CONSTRAINT "MenuImage_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuImage" ADD CONSTRAINT "MenuImage_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemPosition" ADD CONSTRAINT "MenuItemPosition_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuHiddenItem" ADD CONSTRAINT "MenuHiddenItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuHiddenItem" ADD CONSTRAINT "MenuHiddenItem_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuHiddenCategory" ADD CONSTRAINT "MenuHiddenCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuHiddenCategory" ADD CONSTRAINT "MenuHiddenCategory_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuTextOverride" ADD CONSTRAINT "MenuTextOverride_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuTextOverride" ADD CONSTRAINT "MenuTextOverride_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuIngredientOverride" ADD CONSTRAINT "MenuIngredientOverride_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuIngredientOverride" ADD CONSTRAINT "MenuIngredientOverride_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuDotykackaLabel" ADD CONSTRAINT "MenuDotykackaLabel_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuDotykackaLabel" ADD CONSTRAINT "MenuDotykackaLabel_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantDotykacka" ADD CONSTRAINT "RestaurantDotykacka_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAuditEvent" ADD CONSTRAINT "IntegrationAuditEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAuditEvent" ADD CONSTRAINT "IntegrationAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DotykackaOauthState" ADD CONSTRAINT "DotykackaOauthState_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DotykackaOauthState" ADD CONSTRAINT "DotykackaOauthState_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantWelcome" ADD CONSTRAINT "RestaurantWelcome_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantWelcome" ADD CONSTRAINT "RestaurantWelcome_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KioskDeviceBinding" ADD CONSTRAINT "KioskDeviceBinding_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
