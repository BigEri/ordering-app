-- Dotypay / Nexi XPay CEE: API klíč restaurace + relace Pay-by-Link.
CREATE TABLE "RestaurantXpay" (
    "restaurantId" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "disabled" INTEGER NOT NULL DEFAULT 0,
    "createdAtIso" TEXT,
    "updatedAtIso" TEXT NOT NULL,
    "lastOkAtIso" TEXT,
    "lastError" TEXT,

    CONSTRAINT "RestaurantXpay_pkey" PRIMARY KEY ("restaurantId")
);

ALTER TABLE "RestaurantXpay" ADD CONSTRAINT "RestaurantXpay_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "XpayPayment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "tableLabel" TEXT,
    "amountHalere" INTEGER NOT NULL,
    "ordersTotalCzk" INTEGER NOT NULL,
    "tipPct" INTEGER NOT NULL DEFAULT 0,
    "tipAmountCzk" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payUrl" TEXT NOT NULL,
    "linkId" TEXT,
    "securityToken" TEXT,
    "locale" TEXT,
    "paidAtIso" TEXT,
    "cancelledAtIso" TEXT,
    "createdAtIso" TEXT NOT NULL,
    "updatedAtIso" TEXT NOT NULL,
    "tillSettledAtIso" TEXT,
    "tillError" TEXT,
    "notificationJson" TEXT,

    CONSTRAINT "XpayPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_xpay_payment_restaurant" ON "XpayPayment"("restaurantId", "status", "createdAtIso");
CREATE INDEX "idx_xpay_payment_device" ON "XpayPayment"("deviceId", "status");

ALTER TABLE "XpayPayment" ADD CONSTRAINT "XpayPayment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
