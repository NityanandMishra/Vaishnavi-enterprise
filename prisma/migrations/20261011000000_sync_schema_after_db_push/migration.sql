-- AlterTable
ALTER TABLE "Brand" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Category" ADD COLUMN "gstRate" REAL DEFAULT 18.0;
ALTER TABLE "Category" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "Category" ADD COLUMN "sourcingLeadDays" INTEGER DEFAULT 5;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN "altText" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "deletedAt" DATETIME;

-- CreateTable
CREATE TABLE "ProductDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT,
    "userId" TEXT,
    "payload" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductDraft_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "filename" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "snapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" DATETIME
);

-- CreateTable
CREATE TABLE "SavedProductView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Attribute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "inputType" TEXT NOT NULL DEFAULT 'SINGLE_SELECT',
    "isVariantDefining" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "helpText" TEXT,
    "usesSwatches" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "AttributeValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attributeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "swatchHex" TEXT,
    "swatchImageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "AttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategoryAttribute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoryAttribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CategoryAttribute_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductAttributeValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "attributeValueId" TEXT,
    "textValue" TEXT,
    "numberValue" REAL,
    "boolValue" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductAttributeValue_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "AttributeValue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VariantAttributeValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variantId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "attributeValueId" TEXT NOT NULL,
    CONSTRAINT "VariantAttributeValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VariantAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VariantAttributeValue_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "AttributeValue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderLineAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderItemId" TEXT NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderLineAdjustment_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isCustomerVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "totalAmount" REAL NOT NULL,
    "taxAmount" REAL NOT NULL,
    "pdfUrl" TEXT,
    "invoiceData" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" REAL NOT NULL,
    "minOrderValue" REAL NOT NULL DEFAULT 0,
    "maxDiscount" REAL,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT NOT NULL,
    "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeState" TEXT,
    "afterState" TEXT,
    "ipAddress" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "decimalPrecision" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "HsnCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rateType" TEXT NOT NULL DEFAULT 'FLAT',
    "cessRate" REAL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "HsnRateVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hsnId" TEXT NOT NULL,
    "gstRate" REAL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HsnRateVersion_hsnId_fkey" FOREIGN KEY ("hsnId") REFERENCES "HsnCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HsnPriceSlab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rateVersionId" TEXT NOT NULL,
    "minPrice" REAL NOT NULL,
    "maxPrice" REAL,
    "gstRate" REAL NOT NULL,
    CONSTRAINT "HsnPriceSlab_rateVersionId_fkey" FOREIGN KEY ("rateVersionId") REFERENCES "HsnRateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategoryHsnMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "hsnId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CategoryHsnMapping_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CategoryHsnMapping_hsnId_fkey" FOREIGN KEY ("hsnId") REFERENCES "HsnCode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerStateCode" TEXT NOT NULL DEFAULT '27',
    "sellerGstin" TEXT NOT NULL DEFAULT '27AABCV1234K1Z5',
    "pricingMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    "defaultHsnId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxSettings_defaultHsnId_fkey" FOREIGN KEY ("defaultHsnId") REFERENCES "HsnCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "sellerId" TEXT,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER DEFAULT 5,
    "backorderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastCountedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Inventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Inventory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "onHandAfter" INTEGER NOT NULL,
    "reservedAfter" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "batchId" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variantId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAtTrigger" INTEGER NOT NULL,
    "resolvedAt" DATETIME,
    "notifiedAt" DATETIME,
    CONSTRAINT "StockAlert_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "gatewayTransactionId" TEXT,
    "gatewayOrderId" TEXT,
    "method" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "gatewayResponseCode" TEXT,
    "gatewayResponseMessage" TEXT,
    "cardLastFour" TEXT,
    "upiVpaMasked" TEXT,
    "bankName" TEXT,
    "initiatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "gatewayEventId" TEXT,
    "rawPayload" TEXT,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "transactionId" TEXT,
    "refundNumber" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "taxComponentPaise" INTEGER NOT NULL DEFAULT 0,
    "reasonCode" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "gatewayRefundId" TEXT,
    "method" TEXT NOT NULL DEFAULT 'gateway',
    "referenceNumber" TEXT,
    "requestedBy" TEXT,
    "requestedByName" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedByName" TEXT,
    "approvedAt" DATETIME,
    "completedAt" DATETIME,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Refund_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "courierId" TEXT,
    "expectedPaise" INTEGER NOT NULL,
    "collectedPaise" INTEGER,
    "collectedAt" DATETIME,
    "remittanceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "discrepancyNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CodCollection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CodCollection_remittanceId_fkey" FOREIGN KEY ("remittanceId") REFERENCES "CodRemittance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodRemittance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courierId" TEXT NOT NULL,
    "remittanceDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "expectedPaise" INTEGER NOT NULL,
    "receivedPaise" INTEGER NOT NULL,
    "variancePaise" INTEGER NOT NULL DEFAULT 0,
    "bankReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECONCILED',
    "note" TEXT,
    "reconciledBy" TEXT,
    "reconciledByName" TEXT,
    "reconciledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gateway" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "settlementId" TEXT NOT NULL,
    "settlementDate" DATETIME NOT NULL,
    "grossPaise" INTEGER NOT NULL,
    "feesPaise" INTEGER NOT NULL,
    "taxOnFeesPaise" INTEGER NOT NULL,
    "netPaise" INTEGER NOT NULL,
    "bankReference" TEXT,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "reconciledAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReconciliationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementId" TEXT NOT NULL,
    "transactionId" TEXT,
    "gatewayTxnId" TEXT,
    "orderNumber" TEXT,
    "mismatchType" TEXT NOT NULL,
    "platformAmountPaise" INTEGER,
    "gatewayAmountPaise" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedBy" TEXT,
    "resolvedByName" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReconciliationItem_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReconciliationItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gateway" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "eventId" TEXT,
    "eventType" TEXT,
    "rawBody" TEXT NOT NULL,
    "headers" TEXT,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateTable
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "refundApprovalThreshold" INTEGER NOT NULL DEFAULT 1000000,
    "codAutoDiscrepancyHours" INTEGER NOT NULL DEFAULT 48,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);

-- CreateTable
CREATE TABLE "ShippingZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ZoneRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zoneId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "pincode" TEXT,
    "pincodeFrom" TEXT,
    "pincodeTo" TEXT,
    "stateCode" TEXT,
    "region" TEXT,
    "specificity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ZoneRule_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShippingRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zoneId" TEXT NOT NULL,
    "rateType" TEXT NOT NULL,
    "flatAmountPaise" INTEGER,
    "freeAbovePaise" INTEGER,
    "codSurchargePaise" INTEGER,
    "codSurchargePercent" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShippingRate_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShippingRateSlab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shippingRateId" TEXT NOT NULL,
    "minWeightGrams" INTEGER,
    "maxWeightGrams" INTEGER,
    "minValuePaise" INTEGER,
    "maxValuePaise" INTEGER,
    "amountPaise" INTEGER NOT NULL,
    "perAdditionalWeightGrams" INTEGER,
    "perAdditionalAmountPaise" INTEGER,
    CONSTRAINT "ShippingRateSlab_shippingRateId_fkey" FOREIGN KEY ("shippingRateId") REFERENCES "ShippingRate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Courier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "integrationMode" TEXT NOT NULL DEFAULT 'API',
    "credentialsKey" TEXT,
    "supportsCod" BOOLEAN NOT NULL DEFAULT true,
    "supportsReverse" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastApiStatus" TEXT,
    "lastApiError" TEXT,
    "lastApiCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CourierServiceability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courierId" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "supportsCod" BOOLEAN NOT NULL DEFAULT true,
    "transitDays" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourierServiceability_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourierCostRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courierId" TEXT NOT NULL,
    "zoneId" TEXT,
    "minWeightGrams" INTEGER NOT NULL DEFAULT 0,
    "maxWeightGrams" INTEGER,
    "costPaise" INTEGER NOT NULL,
    "codFeePaise" INTEGER NOT NULL DEFAULT 0,
    "transitDays" INTEGER NOT NULL DEFAULT 3,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourierCostRate_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourierCostRate_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "sellerId" TEXT,
    "courierId" TEXT NOT NULL,
    "awbNumber" TEXT,
    "labelUrl" TEXT,
    "estimatedCostPaise" INTEGER,
    "actualCostPaise" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "weightGrams" INTEGER NOT NULL,
    "declaredValuePaise" INTEGER NOT NULL,
    "shippingChargePaise" INTEGER NOT NULL,
    "codAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "pickupScheduledAt" DATETIME,
    "dispatchedAt" DATETIME,
    "deliveredAt" DATETIME,
    "expectedDeliveryDate" DATETIME,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" DATETIME,
    "lastEventDescription" TEXT,
    "lastEventLocation" TEXT,
    "isStuck" BOOLEAN NOT NULL DEFAULT false,
    "rtoReason" TEXT,
    "rtoReceivedAt" DATETIME,
    "returnShippingCostPaise" INTEGER,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Shipment_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShipmentLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "ShipmentLine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShipmentLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "courierStatusCode" TEXT,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "eventAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "rawPayload" TEXT,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Manifest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manifestNumber" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "manifestDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shipmentCount" INTEGER NOT NULL DEFAULT 0,
    "pdfUrl" TEXT,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Manifest_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShippingSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "stuckThresholdHours" INTEGER NOT NULL DEFAULT 48,
    "defaultWeightGrams" INTEGER NOT NULL DEFAULT 500,
    "houseSellerId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT,
    "userId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WEB',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL,
    "subtotalAmount" REAL NOT NULL DEFAULT 0,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "shippingCost" REAL NOT NULL DEFAULT 0,
    "taxableAmount" REAL NOT NULL DEFAULT 0,
    "cgstAmount" REAL NOT NULL DEFAULT 0,
    "sgstAmount" REAL NOT NULL DEFAULT 0,
    "igstAmount" REAL NOT NULL DEFAULT 0,
    "cessAmount" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "balanceAmount" REAL NOT NULL DEFAULT 0,
    "refundDueAmount" REAL NOT NULL DEFAULT 0,
    "shippingAddress" TEXT NOT NULL,
    "billingAddress" TEXT,
    "deliveryStateCode" TEXT,
    "deliveryZone" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerNote" TEXT,
    "couponCode" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "shiprocketOrderId" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "sellerId" TEXT,
    "placedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME,
    "processingAt" DATETIME,
    "packedAt" DATETIME,
    "shippedAt" DATETIME,
    "deliveredAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "cancellationNote" TEXT,
    "slaDueAt" DATETIME,
    "createdBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("createdAt", "deliveryZone", "id", "paymentMethod", "razorpayOrderId", "razorpayPaymentId", "shippingAddress", "shippingCost", "shiprocketOrderId", "status", "totalAmount", "trackingNumber", "trackingUrl", "updatedAt", "userId") SELECT "createdAt", "deliveryZone", "id", "paymentMethod", "razorpayOrderId", "razorpayPaymentId", "shippingAddress", "shippingCost", "shiprocketOrderId", "status", "totalAmount", "trackingNumber", "trackingUrl", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_razorpayOrderId_key" ON "Order"("razorpayOrderId");
CREATE UNIQUE INDEX "Order_razorpayPaymentId_key" ON "Order"("razorpayPaymentId");
CREATE UNIQUE INDEX "Order_shiprocketOrderId_key" ON "Order"("shiprocketOrderId");
CREATE INDEX "Order_status_placedAt_idx" ON "Order"("status", "placedAt");
CREATE INDEX "Order_slaDueAt_idx" ON "Order"("slaDueAt");
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productName" TEXT,
    "variantTitle" TEXT,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "originalPrice" REAL,
    "discountAmount" REAL DEFAULT 0,
    "taxableValue" REAL,
    "hsnCode" TEXT,
    "gstRate" REAL,
    "cgstAmount" REAL DEFAULT 0,
    "sgstAmount" REAL DEFAULT 0,
    "igstAmount" REAL DEFAULT 0,
    "cessAmount" REAL DEFAULT 0,
    "lineTotal" REAL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cancelledQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("id", "orderId", "price", "productId", "quantity", "variantId", "variantTitle") SELECT "id", "orderId", "price", "productId", "quantity", "variantId", "variantTitle" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_sku_idx" ON "OrderItem"("sku");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT,
    "basePrice" REAL NOT NULL,
    "checkoutMode" TEXT NOT NULL,
    "stockMode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sourcingLeadDays" INTEGER,
    "categoryId" TEXT NOT NULL,
    "brandId" TEXT,
    "unit" TEXT DEFAULT 'Piece',
    "unitId" TEXT,
    "sellerId" TEXT,
    "hsnCode" TEXT,
    "hsnId" TEXT,
    "gstRate" REAL,
    "specs" TEXT NOT NULL DEFAULT '{}',
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "publishedAt" DATETIME,
    "archivedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_hsnId_fkey" FOREIGN KEY ("hsnId") REFERENCES "HsnCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("basePrice", "brandId", "categoryId", "checkoutMode", "createdAt", "description", "id", "isAvailable", "specs", "stockMode", "title", "updatedAt") SELECT "basePrice", "brandId", "categoryId", "checkoutMode", "createdAt", "description", "id", "isAvailable", "specs", "stockMode", "title", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE TABLE "new_ProductVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" REAL,
    "mrp" REAL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sku" TEXT,
    "color" TEXT,
    "size" TEXT,
    "weightGrams" REAL,
    "lengthMm" REAL,
    "widthMm" REAL,
    "heightMm" REAL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductVariant" ("color", "id", "isAvailable", "price", "productId", "size", "sku", "stock", "title") SELECT "color", "id", "isAvailable", "price", "productId", "size", "sku", "stock", "title" FROM "ProductVariant";
DROP TABLE "ProductVariant";
ALTER TABLE "new_ProductVariant" RENAME TO "ProductVariant";
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProductDraft_productId_idx" ON "ProductDraft"("productId");

-- CreateIndex
CREATE INDEX "ProductDraft_userId_idx" ON "ProductDraft"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_code_key" ON "Attribute"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeValue_attributeId_code_key" ON "AttributeValue"("attributeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAttribute_categoryId_attributeId_key" ON "CategoryAttribute"("categoryId", "attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "VariantAttributeValue_variantId_attributeId_key" ON "VariantAttributeValue"("variantId", "attributeId");

-- CreateIndex
CREATE INDEX "OrderLineAdjustment_orderItemId_idx" ON "OrderLineAdjustment"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderNote_orderId_createdAt_idx" ON "OrderNote"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_financialYear_sequenceNumber_idx" ON "Invoice"("financialYear", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Review_productId_idx" ON "Review"("productId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "HsnCode_code_key" ON "HsnCode"("code");

-- CreateIndex
CREATE INDEX "HsnRateVersion_hsnId_effectiveFrom_idx" ON "HsnRateVersion"("hsnId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "HsnPriceSlab_rateVersionId_idx" ON "HsnPriceSlab"("rateVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryHsnMapping_categoryId_key" ON "CategoryHsnMapping"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE INDEX "Inventory_locationId_idx" ON "Inventory"("locationId");

-- CreateIndex
CREATE INDEX "Inventory_variantId_idx" ON "Inventory"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_variantId_locationId_key" ON "Inventory"("variantId", "locationId");

-- CreateIndex
CREATE INDEX "InventoryMovement_variantId_createdAt_idx" ON "InventoryMovement"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryId_createdAt_idx" ON "InventoryMovement"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_batchId_idx" ON "InventoryMovement"("batchId");

-- CreateIndex
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx" ON "InventoryMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "StockAlert_variantId_resolvedAt_idx" ON "StockAlert"("variantId", "resolvedAt");

-- CreateIndex
CREATE INDEX "StockAlert_alertType_resolvedAt_idx" ON "StockAlert"("alertType", "resolvedAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_orderId_idx" ON "PaymentTransaction"("orderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_gatewayTransactionId_idx" ON "PaymentTransaction"("gatewayTransactionId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_createdAt_idx" ON "PaymentTransaction"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_gatewayEventId_key" ON "PaymentEvent"("gatewayEventId");

-- CreateIndex
CREATE INDEX "PaymentEvent_transactionId_createdAt_idx" ON "PaymentEvent"("transactionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_refundNumber_key" ON "Refund"("refundNumber");

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Refund_refundNumber_idx" ON "Refund"("refundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CodCollection_orderId_key" ON "CodCollection"("orderId");

-- CreateIndex
CREATE INDEX "CodCollection_courierId_status_idx" ON "CodCollection"("courierId", "status");

-- CreateIndex
CREATE INDEX "CodCollection_status_idx" ON "CodCollection"("status");

-- CreateIndex
CREATE INDEX "CodRemittance_courierId_idx" ON "CodRemittance"("courierId");

-- CreateIndex
CREATE INDEX "CodRemittance_status_idx" ON "CodRemittance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_settlementId_key" ON "Settlement"("settlementId");

-- CreateIndex
CREATE INDEX "Settlement_gateway_settlementDate_idx" ON "Settlement"("gateway", "settlementDate");

-- CreateIndex
CREATE INDEX "Settlement_status_idx" ON "Settlement"("status");

-- CreateIndex
CREATE INDEX "ReconciliationItem_settlementId_idx" ON "ReconciliationItem"("settlementId");

-- CreateIndex
CREATE INDEX "ReconciliationItem_status_idx" ON "ReconciliationItem"("status");

-- CreateIndex
CREATE INDEX "WebhookLog_gateway_eventId_idx" ON "WebhookLog"("gateway", "eventId");

-- CreateIndex
CREATE INDEX "WebhookLog_processed_idx" ON "WebhookLog"("processed");

-- CreateIndex
CREATE INDEX "WebhookLog_signatureValid_idx" ON "WebhookLog"("signatureValid");

-- CreateIndex
CREATE INDEX "ShippingZone_isFallback_idx" ON "ShippingZone"("isFallback");

-- CreateIndex
CREATE INDEX "ShippingZone_isActive_idx" ON "ShippingZone"("isActive");

-- CreateIndex
CREATE INDEX "ZoneRule_zoneId_idx" ON "ZoneRule"("zoneId");

-- CreateIndex
CREATE INDEX "ZoneRule_matchType_pincode_idx" ON "ZoneRule"("matchType", "pincode");

-- CreateIndex
CREATE INDEX "ZoneRule_matchType_stateCode_idx" ON "ZoneRule"("matchType", "stateCode");

-- CreateIndex
CREATE INDEX "ZoneRule_specificity_idx" ON "ZoneRule"("specificity");

-- CreateIndex
CREATE INDEX "ShippingRate_zoneId_isActive_idx" ON "ShippingRate"("zoneId", "isActive");

-- CreateIndex
CREATE INDEX "ShippingRateSlab_shippingRateId_idx" ON "ShippingRateSlab"("shippingRateId");

-- CreateIndex
CREATE UNIQUE INDEX "Courier_code_key" ON "Courier"("code");

-- CreateIndex
CREATE INDEX "Courier_priority_isActive_idx" ON "Courier"("priority", "isActive");

-- CreateIndex
CREATE INDEX "CourierServiceability_pincode_idx" ON "CourierServiceability"("pincode");

-- CreateIndex
CREATE INDEX "CourierServiceability_courierId_isActive_idx" ON "CourierServiceability"("courierId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CourierServiceability_courierId_pincode_key" ON "CourierServiceability"("courierId", "pincode");

-- CreateIndex
CREATE INDEX "CourierCostRate_courierId_zoneId_idx" ON "CourierCostRate"("courierId", "zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentNumber_key" ON "Shipment"("shipmentNumber");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_status_lastEventAt_idx" ON "Shipment"("status", "lastEventAt");

-- CreateIndex
CREATE INDEX "Shipment_isStuck_idx" ON "Shipment"("isStuck");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_courierId_awbNumber_key" ON "Shipment"("courierId", "awbNumber");

-- CreateIndex
CREATE INDEX "ShipmentLine_shipmentId_idx" ON "ShipmentLine"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentLine_orderLineId_idx" ON "ShipmentLine"("orderLineId");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_eventAt_idx" ON "ShipmentEvent"("shipmentId", "eventAt");

-- CreateIndex
CREATE UNIQUE INDEX "Manifest_manifestNumber_key" ON "Manifest"("manifestNumber");

-- CreateIndex
CREATE INDEX "Manifest_courierId_manifestDate_idx" ON "Manifest"("courierId", "manifestDate");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_parentId_key" ON "Category"("name", "parentId");

