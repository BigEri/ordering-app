-- XPay: výběr položek pro rozdělení účtu v Dotykačce.
ALTER TABLE "XpayPayment" ADD COLUMN "splitItemsJson" TEXT;
