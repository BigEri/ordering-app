-- Trvalá telemetrie tabletu (spolehlivější než paměť na serverless).
ALTER TABLE "KioskDeviceBinding" ADD COLUMN "lastSeenAtIso" TEXT;
ALTER TABLE "KioskDeviceBinding" ADD COLUMN "kioskApkVersionCode" INTEGER;
