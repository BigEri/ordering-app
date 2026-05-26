-- Session invalidation, device secrets, POS dedupe/webhook persistence
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "KioskDeviceBinding" ADD COLUMN "deviceSecret" TEXT;
ALTER TABLE "KioskDeviceBinding" ADD COLUMN "reloadNonce" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PosRequestDedupe" (
    "clientRequestId" TEXT NOT NULL,
    "completedAtIso" TEXT NOT NULL,
    CONSTRAINT "PosRequestDedupe_pkey" PRIMARY KEY ("clientRequestId")
);

CREATE INDEX "idx_pos_dedupe_completed" ON "PosRequestDedupe"("completedAtIso");

CREATE TABLE "PosActionWebhookCallback" (
    "callbackId" TEXT NOT NULL,
    "body" TEXT,
    "createdAtIso" TEXT NOT NULL,
    "expiresAtIso" TEXT NOT NULL,
    "resolvedAtIso" TEXT,
    CONSTRAINT "PosActionWebhookCallback_pkey" PRIMARY KEY ("callbackId")
);

CREATE INDEX "idx_pos_webhook_cb_exp" ON "PosActionWebhookCallback"("expiresAtIso");
