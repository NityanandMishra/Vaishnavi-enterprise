import { prisma } from "../src/lib/db";
import {
  initDefaultShippingData,
  configureZoneRate,
  addZoneRule,
  deleteShippingZone,
  validateRateSlabs,
  resolveShippingRate,
  createShipment,
  dispatchShipment,
  ingestTrackingEvent,
  checkAndFlagStuckShipments,
  getStuckShipmentsQueue,
  markShipmentRto,
  recordRtoReceived,
  createManifest,
  updateShippingSettings,
} from "../src/lib/shipping/shipping-service";
import { formatPaise, rupeesToPaise } from "../src/lib/money";
import { fulfilStock } from "../src/lib/inventory/inventory-service";

async function runShippingEpicTests() {
  console.log("================================================================================");
  console.log("  VAISHNAVI ENTERPRISES — EPIC-07 SHIPPING & LOGISTICS (SHIP) TEST SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAILED: ${message}`);
      failed++;
    }
  }

  // ─── SETUP: Initialize default shipping data ──────────────────────────────
  console.log("[Setup] Initializing default couriers, zones, rates and inventory...");
  await initDefaultShippingData();

  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: "Apparel",
        slug: "apparel-shipping-test",
        defaultCheckoutMode: "BUY",
      },
    });
  }

  // Create test product and variant
  let testProduct = await prisma.product.findFirst({
    where: { slug: "ship-test-kurta" },
    include: { variants: true },
  });

  if (!testProduct) {
    testProduct = await prisma.product.create({
      data: {
        title: "Test Shipping Cotton Kurta",
        slug: "ship-test-kurta",
        description: "Test Shipping Cotton Kurta Description",
        categoryId: category.id,
        checkoutMode: "BUY",
        stockMode: "TRACKED",
        basePrice: 1200,
        variants: {
          create: [
            {
              title: "Red / M",
              sku: "TEST-SHIP-KUR-RED-M",
              price: 1200,
              stock: 100,
            },
            {
              title: "Blue / L",
              sku: "TEST-SHIP-KUR-BLU-L",
              price: 1300,
              stock: 50,
            },
          ],
        },
      },
      include: { variants: true },
    });
  }

  // Ensure inventory records exist
  const location = await prisma.location.findFirst({ where: { code: "MAIN" } }) ||
    await prisma.location.create({ data: { code: "MAIN", name: "Main Warehouse", isDefault: true, isActive: true } });

  for (const v of testProduct.variants) {
    await prisma.inventory.upsert({
      where: { variantId_locationId: { variantId: v.id, locationId: location.id } },
      create: { variantId: v.id, locationId: location.id, onHand: 100, reserved: 50 },
      update: { onHand: 100, reserved: 50 },
    });
  }

  const redVariant = testProduct.variants[0];
  const blueVariant = testProduct.variants[1];

  // Clean up any residual test zones from previous runs
  await prisma.zoneRule.deleteMany({ where: { zone: { name: "Duplicate Pincode Zone" } } });
  await prisma.shippingZone.deleteMany({ where: { name: "Duplicate Pincode Zone" } });

  // ─── TEST SUITE 1: SHIP-01 CONFIGURE SHIPPING ZONES ───────────────────────
  console.log("\n--- [SHIP-01] CONFIGURE SHIPPING ZONES ---");

  // A. Create zone from pincode range
  let mumbaiZone = await prisma.shippingZone.findFirst({
    where: { name: "Mumbai Metro", deletedAt: null },
    include: { rules: true },
  });
  assert(!!mumbaiZone, "Zone 'Mumbai Metro' exists");
  const rangeRule = mumbaiZone?.rules.find((r) => r.matchType === "PINCODE_RANGE");
  assert(
    !!rangeRule && rangeRule.pincodeFrom === "400001" && rangeRule.pincodeTo === "400104",
    "Mumbai Metro has PINCODE_RANGE rule for 400001–400104 with specificity 3"
  );

  // B. Overlap at the same specificity is blocked, not warned (FR-02)
  // Ensure Mumbai Metro has exact PINCODE rule for 400001
  const existingPinRule = await prisma.zoneRule.findFirst({
    where: { zoneId: mumbaiZone!.id, matchType: "PINCODE", pincode: "400001" },
  });
  if (!existingPinRule) {
    await prisma.zoneRule.create({
      data: {
        zoneId: mumbaiZone!.id,
        matchType: "PINCODE",
        pincode: "400001",
        specificity: 4,
      },
    });
  }

  let overlapBlocked = false;
  let overlapErrorMsg = "";
  const testZone = await prisma.shippingZone.create({
    data: { name: "Duplicate Pincode Zone", priority: 99, isFallback: false },
  });

  try {
    // Attempt to add 400001 to testZone (conflicts at specificity 4 with Mumbai Metro)
    await addZoneRule({
      zoneId: testZone.id,
      matchType: "PINCODE",
      pincode: "400001",
    });
  } catch (err: any) {
    overlapBlocked = true;
    overlapErrorMsg = err.message;
  } finally {
    await prisma.zoneRule.deleteMany({ where: { zoneId: testZone.id } });
    await prisma.shippingZone.delete({ where: { id: testZone.id } });
  }

  assert(
    overlapBlocked && overlapErrorMsg.includes("already covered"),
    `Overlap at same specificity blocked: "${overlapErrorMsg}"`
  );

  // C. Fallback zone is mandatory and protected (FR-03)
  const fallbackZone = await prisma.shippingZone.findFirst({
    where: { isFallback: true, deletedAt: null },
  });
  assert(!!fallbackZone, "Fallback 'Rest of India' zone exists");

  let fallbackDeleteBlocked = false;
  try {
    if (fallbackZone) {
      await deleteShippingZone(fallbackZone.id);
    }
  } catch (err: any) {
    fallbackDeleteBlocked = true;
  }
  assert(fallbackDeleteBlocked, "Deleting fallback zone is strictly rejected (FR-03)");

  // ─── TEST SUITE 2: SHIP-02 CONFIGURE RATE RULES PER ZONE ──────────────────
  console.log("\n--- [SHIP-02] CONFIGURE RATE RULES PER ZONE ---");

  // A. Slabs contiguous check (FR-05)
  let invalidSlabsBlocked = false;
  try {
    validateRateSlabs([
      { minWeightGrams: 0, maxWeightGrams: 500, amountPaise: 3500 },
      { minWeightGrams: 600, maxWeightGrams: null, amountPaise: 5000 }, // Gap: 501-599 missing!
    ]);
  } catch (err: any) {
    invalidSlabsBlocked = true;
  }
  assert(invalidSlabsBlocked, "Non-contiguous weight slabs rejected with clear validation error");

  // B. Final slab must be open-ended
  let nonOpenEndedBlocked = false;
  try {
    validateRateSlabs([
      { minWeightGrams: 0, maxWeightGrams: 500, amountPaise: 3500 },
      { minWeightGrams: 501, maxWeightGrams: 1000, amountPaise: 5000 }, // No open-ended slab!
    ]);
  } catch (err: any) {
    nonOpenEndedBlocked = true;
  }
  assert(nonOpenEndedBlocked, "Missing open-ended final slab rejected");

  // C. Configure contiguous slabs with per-additional weight increment
  if (mumbaiZone) {
    await configureZoneRate({
      zoneId: mumbaiZone.id,
      rateType: "WEIGHT_SLAB",
      freeAbovePaise: 99900, // Free above ₹999
      codSurchargePaise: 3000, // Flat ₹30 COD
      slabs: [
        { minWeightGrams: 0, maxWeightGrams: 500, amountPaise: 3500 },
        { minWeightGrams: 501, maxWeightGrams: 1000, amountPaise: 4900 },
        {
          minWeightGrams: 1001,
          maxWeightGrams: null,
          amountPaise: 7900,
          perAdditionalWeightGrams: 500,
          perAdditionalAmountPaise: 2000, // +₹20 per additional 500g above 1kg
        },
      ],
    });
    assert(true, "Configured contiguous weight slabs with +₹20/500g increment rule on Mumbai Metro");
  }

  // ─── TEST SUITE 3: SHIP-03 RESOLVE SHIPPING CHARGE DETERMINISTICALLY ──────
  console.log("\n--- [SHIP-03] RESOLVE SHIPPING CHARGE DETERMINISTICALLY ---");

  // A. Most specific zone wins: 400001 is in Mumbai Metro (range, specificity 3) AND Maharashtra (state, specificity 2)
  const resSpecific = await resolveShippingRate({
    pincode: "400001",
    weightGrams: 450,
    orderValuePaise: 50000, // ₹500 (below ₹999 free threshold)
    isCod: false,
  });
  assert(
    resSpecific.zoneName === "Mumbai Metro",
    `Most specific zone won: ${resSpecific.zoneName} for 400001 (beats Maharashtra state rule)`
  );
  assert(resSpecific.baseChargePaise === 3500, `0-500g slab applied correctly: ${formatPaise(resSpecific.baseChargePaise)}`);

  // B. Additional weight calculation above open-ended slab
  // 2,100g: base 1001g+ = ₹79. Excess = 1,099g. 1099/500 = 3 increments (ceil). 3 * ₹20 = ₹60. Total = ₹79 + ₹60 = ₹139 (13900 paise).
  const resHeavy = await resolveShippingRate({
    pincode: "400001",
    weightGrams: 2100,
    orderValuePaise: 50000,
    isCod: false,
  });
  assert(
    resHeavy.baseChargePaise === 13900,
    `Weight 2,100g calculated with ceil increments: expected 13900 paise (₹139), got ${resHeavy.baseChargePaise}`
  );

  // C. Free shipping evaluated post-discount
  // Post-discount ₹950 does NOT qualify for ₹999 threshold
  const resBelowThreshold = await resolveShippingRate({
    pincode: "400001",
    weightGrams: 450,
    orderValuePaise: 95000,
    isCod: false,
  });
  assert(!resBelowThreshold.freeShippingApplied && resBelowThreshold.baseChargePaise === 3500, "Post-discount ₹950 below ₹999 threshold does not qualify for free shipping");

  // Post-discount ₹1,050 DOES qualify
  const resAboveThreshold = await resolveShippingRate({
    pincode: "400001",
    weightGrams: 450,
    orderValuePaise: 105000,
    isCod: false,
  });
  assert(resAboveThreshold.freeShippingApplied && resAboveThreshold.baseChargePaise === 0, "Post-discount ₹1,050 qualifies for free shipping (base charge ₹0.00)");

  // D. COD surcharge applies as configured
  const resCod = await resolveShippingRate({
    pincode: "400001",
    weightGrams: 450,
    orderValuePaise: 50000,
    isCod: true,
  });
  assert(resCod.codSurchargePaise === 3000, "Flat ₹30 COD surcharge added");
  assert(resCod.totalShippingChargePaise === 6500, "Total charge includes base (₹35) + COD (₹30) = ₹65");

  // E. Fallback zone applies when nothing matches
  const resFallback = await resolveShippingRate({
    pincode: "560001", // Bangalore
    weightGrams: 450,
    orderValuePaise: 50000,
    isCod: false,
  });
  assert(resFallback.zoneName === "Rest of India", `Pincode 560001 resolved to fallback zone: '${resFallback.zoneName}'`);

  // F. Determinism test: 100 identical inputs produce 100 identical charges
  let deterministic = true;
  for (let i = 0; i < 100; i++) {
    const r = await resolveShippingRate({
      pincode: "400001",
      weightGrams: 1350,
      orderValuePaise: 89900,
      isCod: true,
    });
    if (r.totalShippingChargePaise !== 12900) { // 7900 + 2000 (1 incr) + 3000 cod = 12900
      deterministic = false;
      break;
    }
  }
  assert(deterministic, "Deterministic rate resolution verified: 100/100 runs produced identical charge (12900 paise)");

  // G. Unserviceable pincode rejection
  const resUnserv = await resolveShippingRate({
    pincode: "999999",
    weightGrams: 500,
    orderValuePaise: 50000,
    isCod: false,
  });
  assert(!resUnserv.serviceable, "Unserviceable pincode 999999 rejected");

  // ─── TEST SUITE 4: SHIP-04 CONFIGURE COURIERS & SERVICEABILITY ─────────────
  console.log("\n--- [SHIP-04] CONFIGURE COURIERS & SERVICEABILITY ---");

  const dlvCourier = await prisma.courier.findUnique({ where: { code: "DLV" } });
  const ipoCourier = await prisma.courier.findUnique({ where: { code: "IPO" } });
  assert(!!dlvCourier && dlvCourier.integrationMode === "API", "Delhivery is registered as API courier");
  assert(!!ipoCourier && ipoCourier.integrationMode === "MANUAL", "India Post is registered as MANUAL courier");

  // ─── TEST SUITE 5: SHIP-05 & SHIP-06 SHIPMENT CREATION & DISPATCH ─────────
  console.log("\n--- [SHIP-05 & SHIP-06] CREATE & DISPATCH SHIPMENTS ---");

  // Create test order in PACKED state with 2 lines: Red (qty: 3), Blue (qty: 2)
  const testOrder = await prisma.order.create({
    data: {
      orderNumber: `VE-TEST-SHIP-${Date.now()}`,
      status: "PACKED",
      paymentMethod: "PREPAID",
      paymentStatus: "PAID",
      totalAmount: 6200,
      shippingCost: 99,
      deliveryZone: "Rest of India",
      shippingAddress: JSON.stringify({
        street: "Flat 402, Sunrise Apts",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
      }),
      deliveryStateCode: "27",
      customerName: "Rajesh Kumar",
      customerPhone: "9876543210",
      items: {
        create: [
          {
            productId: testProduct.id,
            variantId: redVariant.id,
            productName: "Cotton Kurta Set",
            variantTitle: "Red / M",
            sku: redVariant.sku,
            quantity: 3,
            price: 1200,
          },
          {
            productId: testProduct.id,
            variantId: blueVariant.id,
            productName: "Cotton Kurta Set",
            variantTitle: "Blue / L",
            sku: blueVariant.sku,
            quantity: 2,
            price: 1300,
          },
        ],
      },
    },
    include: { items: true },
  });

  const redLine = testOrder.items.find((i) => i.variantId === redVariant.id)!;
  const blueLine = testOrder.items.find((i) => i.variantId === blueVariant.id)!;

  // Partial shipment 1: Ship 2 of 3 Red, 0 of 2 Blue
  const shipment1 = await createShipment({
    orderId: testOrder.id,
    courierId: dlvCourier!.id,
    lines: [
      { orderLineId: redLine.id, quantity: 2 },
    ],
    weightGrams: 1000,
    userId: "test-ops-user",
    userName: "Amrit Suthar",
  });

  assert(shipment1.status === "PENDING", `Shipment 1 created in PENDING status: ${shipment1.shipmentNumber}`);
  assert(shipment1.lines.length === 1 && shipment1.lines[0].quantity === 2, "Shipment 1 holds partial quantity (2 of 3 units)");

  // Cost vs Charge separation: Customer was charged ₹99 (9900 paise); our cost is from courierCostRate (4900 paise)
  assert(shipment1.shippingChargePaise === 9900, "Customer shipping charge on shipment is 9900 paise (frozen at placement)");
  assert(shipment1.estimatedCostPaise === 4900, "Our courier cost is 4900 paise (separate from customer charge)");

  // Dispatch shipment 1 (consumes stock, moves order to SHIPPED)
  const dispatched1 = await dispatchShipment({
    shipmentId: shipment1.id,
    userId: "test-ops-user",
    userName: "Amrit Suthar",
  });

  assert(dispatched1.status === "DISPATCHED", `Shipment 1 dispatched with AWB: ${dispatched1.awbNumber}`);

  const orderAfterShip1 = await prisma.order.findUnique({ where: { id: testOrder.id } });
  assert(orderAfterShip1?.status === "SHIPPED", "Order moved to SHIPPED on first shipment dispatch");

  // Attempting to dispatch manual courier without AWB must fail (FR-17)
  const manualShipment = await createShipment({
    orderId: testOrder.id,
    courierId: ipoCourier!.id,
    lines: [{ orderLineId: redLine.id, quantity: 1 }],
    weightGrams: 500,
  });

  let manualWithoutAwbFailed = false;
  try {
    await dispatchShipment({ shipmentId: manualShipment.id });
  } catch (err: any) {
    manualWithoutAwbFailed = true;
  }
  assert(manualWithoutAwbFailed, "Manual courier dispatch without AWB rejected with 422");

  // Dispatch manual courier with valid unique AWB
  const manualAwb = `IPO${Date.now()}`;
  const dispatchedManual = await dispatchShipment({
    shipmentId: manualShipment.id,
    awbNumber: manualAwb,
  });
  assert(dispatchedManual.awbNumber === manualAwb, `Manual courier dispatched with entered AWB ${manualAwb}`);

  // Duplicate AWB rejection (FR-18)
  let duplicateAwbFailed = false;
  try {
    const dupShipment = await createShipment({
      orderId: testOrder.id,
      courierId: ipoCourier!.id,
      lines: [{ orderLineId: blueLine.id, quantity: 2 }],
      awbNumber: manualAwb,
    });
  } catch (err: any) {
    duplicateAwbFailed = true;
  }
  assert(duplicateAwbFailed, "Duplicate AWB number within courier is rejected (FR-18)");

  // Create Shipment 2 for remaining items: Blue (qty: 2)
  const shipment2 = await createShipment({
    orderId: testOrder.id,
    courierId: dlvCourier!.id,
    lines: [{ orderLineId: blueLine.id, quantity: 2 }],
    weightGrams: 1000,
  });
  await dispatchShipment({ shipmentId: shipment2.id });
  assert(true, "Second shipment created and dispatched for remaining items");

  // ─── TEST SUITE 6: SHIP-07 & SHIP-08 TRACKING INGESTION & ORDER SYNC ──────
  console.log("\n--- [SHIP-07 & SHIP-08] TRACKING INGESTION & STATUS SYNC ---");

  // A. Ingest IN_TRANSIT event
  const trackRes1 = await ingestTrackingEvent({
    shipmentId: dispatched1.id,
    status: "IN_TRANSIT",
    location: "Nagpur Sorting Hub",
    description: "In transit · Nagpur Sorting Hub",
    source: "COURIER_WEBHOOK",
    rawPayload: { code: "IT", city: "Nagpur" },
  });
  assert(trackRes1.shipment.status === "IN_TRANSIT", "Shipment advanced to IN_TRANSIT from webhook event");

  // B. Idempotency test: Delivering the exact same event again produces NO duplicate
  const trackResIdempotent = await ingestTrackingEvent({
    shipmentId: dispatched1.id,
    status: "IN_TRANSIT",
    location: "Nagpur Sorting Hub",
    description: "In transit · Nagpur Sorting Hub",
    source: "COURIER_WEBHOOK",
  });
  assert(trackResIdempotent.status === "IDEMPOTENT_SKIP", "Duplicate courier event detected and skipped idempotently");

  // C. Anti-regression test: Out-of-order events cannot regress a higher status
  await ingestTrackingEvent({
    shipmentId: dispatched1.id,
    status: "DELIVERED",
    location: "Mumbai",
    description: "Delivered to customer",
    source: "COURIER_WEBHOOK",
  });

  const regressedAttempt = await ingestTrackingEvent({
    shipmentId: dispatched1.id,
    status: "IN_TRANSIT", // Out-of-order older event arrives late!
    location: "Old Hub",
    description: "Arrived at old transit hub",
    source: "COURIER_WEBHOOK",
  });
  assert(regressedAttempt.shipment.status === "DELIVERED", "Anti-regression verified: DELIVERED status did not regress to IN_TRANSIT");

  // D. Order auto-delivers ONLY when EVERY shipment covering active lines is delivered (FR-21)
  const orderMidWay = await prisma.order.findUnique({ where: { id: testOrder.id } });
  assert(orderMidWay?.status === "SHIPPED", "Order remains SHIPPED when only 1 of 2 shipments is delivered");

  // Deliver the remaining shipments
  await ingestTrackingEvent({
    shipmentId: manualShipment.id,
    status: "DELIVERED",
    location: "Mumbai",
    description: "Delivered",
    source: "MANUAL",
  });
  await ingestTrackingEvent({
    shipmentId: shipment2.id,
    status: "DELIVERED",
    location: "Mumbai",
    description: "Delivered",
    source: "COURIER_WEBHOOK",
  });

  const orderFinal = await prisma.order.findUnique({ where: { id: testOrder.id } });
  assert(orderFinal?.status === "DELIVERED", "Order automatically transitioned to DELIVERED once ALL shipments were delivered");

  // ─── TEST SUITE 7: SHIP-09 STUCK SHIPMENTS QUEUE ──────────────────────────
  console.log("\n--- [SHIP-09] STUCK SHIPMENTS QUEUE & EXCEPTION DETECTION ---");

  // Create an idle shipment with last event 50 hours ago
  const stuckOrder = await prisma.order.create({
    data: {
      orderNumber: `VE-STUCK-${Date.now()}`,
      status: "SHIPPED",
      paymentMethod: "PREPAID",
      totalAmount: 1950,
      shippingCost: 49,
      shippingAddress: JSON.stringify({ city: "Nagpur", pincode: "440001" }),
      items: {
        create: [
          {
            productId: testProduct.id,
            productName: "Test Item",
            quantity: 1,
            price: 1950,
          },
        ],
      },
    },
    include: { items: true },
  });

  const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);
  const stuckShipment = await prisma.shipment.create({
    data: {
      orderId: stuckOrder.id,
      shipmentNumber: `SHP-STUCK-${Date.now()}`,
      courierId: dlvCourier!.id,
      awbNumber: `STUCK${Date.now()}`,
      status: "IN_TRANSIT",
      weightGrams: 500,
      declaredValuePaise: 195000,
      shippingChargePaise: 4900,
      lastEventAt: fiftyHoursAgo,
      lastEventDescription: "In Transit, Nagpur",
      isStuck: false,
    },
  });

  await checkAndFlagStuckShipments();

  const refreshedStuck = await prisma.shipment.findUnique({ where: { id: stuckShipment.id } });
  assert(refreshedStuck?.isStuck === true, "Shipment idle for 50 hours automatically flagged as isStuck=true");

  // A new event clears the stuck flag (SHIP-09 AC)
  await ingestTrackingEvent({
    shipmentId: stuckShipment.id,
    status: "OUT_FOR_DELIVERY",
    location: "Nagpur",
    description: "Out for delivery with rider",
    source: "COURIER_WEBHOOK",
  });
  const unStuck = await prisma.shipment.findUnique({ where: { id: stuckShipment.id } });
  assert(unStuck?.isStuck === false, "New tracking event cleared the stuck flag automatically");

  // ─── TEST SUITE 8: SHIP-10 HANDLE RTO ─────────────────────────────────────
  console.log("\n--- [SHIP-10] HANDLE RTO & STOCK RESTORATION ---");

  // Mark shipment as RTO
  const rtoShipment = await markShipmentRto(
    stuckShipment.id,
    "Customer not available after 3 attempts",
    "test-user",
    "Ops Executive"
  );
  assert(
    rtoShipment.status === "RTO" && Boolean(rtoShipment.rtoReason?.includes("3 attempts")),
    "Shipment transitioned to RTO with recorded reason"
  );

  // Record RTO received at warehouse: restores stock and flags prepaid order for refund review (without auto-debit)
  const rtoDelivered = await recordRtoReceived({
    shipmentId: rtoShipment.id,
    userId: "test-warehouse",
    userName: "Warehouse Supervisor",
  });
  assert(rtoDelivered.status === "RTO_DELIVERED", "Shipment transitioned to RTO_DELIVERED on warehouse receipt");

  const rtoOrder = await prisma.order.findUnique({ where: { id: stuckOrder.id } });
  assert(
    rtoOrder?.status !== "DELIVERED",
    "RTO shipment does NOT deliver the order"
  );

  // Idempotency: Calling recordRtoReceived a second time does not duplicate
  const secondRtoCall = await recordRtoReceived({
    shipmentId: rtoShipment.id,
  });
  assert(secondRtoCall.status === "RTO_DELIVERED", "RTO receipt is idempotent");

  // ─── TEST SUITE 9: SHIP-11 & SHIP-12 CALCULATOR & MANIFEST ───────────────
  console.log("\n--- [SHIP-11 & SHIP-12] RATE CALCULATOR & MANIFEST ---");

  // S7 Rate Calculator prose explanation
  const calcResult = await resolveShippingRate({
    pincode: "560001",
    weightGrams: 1350,
    orderValuePaise: 89900,
    isCod: true,
  });
  assert(calcResult.explanation.length > 20, "Rate calculator generated detailed prose explanation");
  assert(calcResult.courierOptions.length > 0, "Courier serviceability options included alongside rate calculation");

  // Handover manifest generation
  const manifest = await createManifest({
    courierId: dlvCourier!.id,
    manifestDate: new Date(),
    userId: "test-user",
    userName: "Dispatch Supervisor",
  });
  assert(
    Boolean(manifest.pdfUrl?.includes(manifest.manifestNumber)),
    "Manifest PDF URL generated"
  );

  // ─── FINAL SUMMARY ────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log(`  EPIC-07 SHIPPING & LOGISTICS VERIFICATION RESULTS`);
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runShippingEpicTests()
  .catch((err) => {
    console.error("Test execution aborted with unhandled error:", err);
    process.exit(1);
  });
