-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TaxSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerLegalName" TEXT,
    "sellerTradeName" TEXT,
    "sellerGstin" TEXT,
    "sellerStateCode" TEXT,
    "sellerAddressLine1" TEXT,
    "sellerAddressLine2" TEXT,
    "sellerCity" TEXT,
    "sellerPincode" TEXT,
    "sellerPhone" TEXT,
    "sellerEmail" TEXT,
    "pricingMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    "defaultHsnId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxSettings_defaultHsnId_fkey" FOREIGN KEY ("defaultHsnId") REFERENCES "HsnCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TaxSettings" ("defaultHsnId", "id", "pricingMode", "sellerGstin", "sellerStateCode", "updatedAt") SELECT "defaultHsnId", "id", "pricingMode", "sellerGstin", "sellerStateCode", "updatedAt" FROM "TaxSettings";
DROP TABLE "TaxSettings";
ALTER TABLE "new_TaxSettings" RENAME TO "TaxSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Data: remove the fake placeholder GSTIN so invoicing is blocked until the real one is entered.
UPDATE "TaxSettings" SET "sellerGstin" = NULL WHERE "sellerGstin" = '27AABCV1234K1Z5';

-- Data: business facts supplied by the owner (Suriyawan, Bhadohi, Uttar Pradesh).
-- Street address, city, GSTIN, phone and email are left empty for the owner to fill in.
UPDATE "TaxSettings"
SET "sellerStateCode" = '09', "sellerPincode" = '221404', "sellerLegalName" = 'Vaishnavi Enterprises'
WHERE "sellerStateCode" = '27';
