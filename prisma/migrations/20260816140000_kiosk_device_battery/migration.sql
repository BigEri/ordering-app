-- Stav baterie z kiosk APK (poll /api/devices/config).
ALTER TABLE "KioskDeviceBinding" ADD COLUMN "batteryPercent" INTEGER;
ALTER TABLE "KioskDeviceBinding" ADD COLUMN "batteryCharging" INTEGER;
