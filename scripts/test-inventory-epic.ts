import { PrismaClient } from "@prisma/client";
import {
  adjustStock,
  reserveStock,
  fulfilStock,
  releaseStock,
  releaseExpiredReservations,
  restoreRtoStock,
  bulkAdjustStock,
  undoBulkAdjust,
  importStockCsv,
  getOrCreateInventory,
  deriveStockStatus,
  ConflictError,
  PreconditionRequiredError,
  getDefaultLocation,
} from "../src/lib/inventory/inventory-service";
import {
  ReasonCode,
  MovementType,
  StockStatus,
  StockAlertTypes,
} from "../src/lib/inventory/types";

const prisma = new PrismaClient();

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    passedTests++;
    console.log(`  ✔ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✖ FAIL: ${testName}`, details ? details : "");
  }
}

async function runAllSuites() {
  console.log("===============================================================================");
  console.log("             EPIC-04: INVENTORY / STOCK MANAGEMENT — TEST SUITE                ");
  console.log("===============================================================================\n");

  const location = await getDefaultLocation();

  // Create test Category and Product
  let testCat = await prisma.category.findFirst({ where: { slug: "inv-test-cat" } });
  if (!testCat) {
    testCat = await prisma.category.create({
      data: {
        name: "Inventory Test Category",
        slug: "inv-test-cat",
      },
    });
  }

  const uniqueSuffix = Date.now();
  const testProduct = await prisma.product.create({
    data: {
      title: `Test Product ${uniqueSuffix}`,
      slug: `test-product-${uniqueSuffix}`,
      description: "Inventory testing product",
      basePrice: 500,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      categoryId: testCat.id,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 1: AUTO-CREATION & BASELINE INVARIANTS (INV-01)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- SUITE 1: Auto-Creation & Baseline Invariants (INV-01) ---");

  const v1 = await prisma.productVariant.create({
    data: {
      productId: testProduct.id,
      title: "Red / M",
      sku: `TEST-SKU-RED-M-${uniqueSuffix}`,
      price: 500,
      stock: 0,
    },
  });

  const inv1 = await getOrCreateInventory(v1.id, location.id);
  assert(inv1 !== null, "Inventory record is created for variant");
  assert(inv1.onHand === 0, "Initial on_hand is 0");
  assert(inv1.reserved === 0, "Initial reserved is 0");
  assert(inv1.onHand - inv1.reserved === 0, "Initial available is 0");
  assert(
    deriveStockStatus(inv1.onHand, inv1.reserved, inv1.lowStockThreshold ?? 5) === StockStatus.OUT_OF_STOCK,
    "Status derived as OUT_OF_STOCK when available = 0"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 2: MANUAL ADJUSTMENTS WITH MANDATORY REASON (INV-02)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 2: Manual Adjustments with Mandatory Reason (INV-02) ---");

  // Add stock with PURCHASE reason
  const adj1 = await adjustStock({
    variantId: v1.id,
    mode: "DELTA",
    quantity: 50,
    reasonCode: ReasonCode.PURCHASE,
    note: "Received from supplier — invoice 4412",
    actorId: "tester-1",
    actorName: "Amrit Suthar",
  });
  assert(adj1.onHand === 50, "Add 50 units increases on_hand to 50");
  assert(adj1.available === 50, "Available becomes 50");
  assert(adj1.status === StockStatus.IN_STOCK, "Status updates to IN_STOCK");

  // Verify immutable movement row
  const mov1 = await prisma.inventoryMovement.findUnique({
    where: { id: adj1.movementId },
  });
  assert(mov1?.quantityDelta === 50, "Ledger records quantity_delta +50");
  assert(mov1?.onHandAfter === 50, "Ledger records on_hand_after 50");
  assert(mov1?.reasonCode === ReasonCode.PURCHASE, "Ledger records reason PURCHASE");
  assert(mov1?.createdBy === "Amrit Suthar", "Ledger records actor name");

  // Sensitive reason note length check (< 10 chars must fail)
  let sensitiveFailed = false;
  try {
    await adjustStock({
      variantId: v1.id,
      mode: "DELTA",
      quantity: -2,
      reasonCode: ReasonCode.DAMAGE,
      note: "short", // 5 chars
      actorId: "tester-1",
    });
  } catch (err: any) {
    sensitiveFailed = true;
  }
  assert(sensitiveFailed, "Damage adjustment with note < 10 characters is rejected");

  // Sensitive reason with note >= 10 chars succeeds
  const adjDamage = await adjustStock({
    variantId: v1.id,
    mode: "DELTA",
    quantity: -3,
    reasonCode: ReasonCode.DAMAGE,
    note: "Water damage in transit, 3 pieces",
    actorId: "tester-1",
  });
  assert(adjDamage.onHand === 47, "Damage adjustment reduces on_hand to 47");

  // ABSOLUTE set mode (FR-09: stored as delta)
  const adjSet = await adjustStock({
    variantId: v1.id,
    mode: "ABSOLUTE",
    quantity: 50, // 47 -> 50, delta is +3 (< 25%)
    reasonCode: ReasonCode.CORRECTION,
    note: "Physical count found 50 pieces in rack A",
    actorId: "tester-1",
  });
  assert(adjSet.onHand === 50, "Set to 50 updates on_hand to 50");
  assert(adjSet.delta === 3, "Absolute set calculates signed delta +3");

  // Negative stock prevention (FR-03)
  let negativeBlocked = false;
  try {
    await adjustStock({
      variantId: v1.id,
      mode: "DELTA",
      quantity: -100, // on_hand is 60, -100 would be -40
      reasonCode: ReasonCode.CORRECTION,
      note: "Testing negative stock rejection",
      actorId: "tester-1",
    });
  } catch (err: any) {
    if (err instanceof ConflictError) negativeBlocked = true;
  }
  assert(negativeBlocked, "Adjustment driving on_hand negative is blocked with ConflictError (409)");

  // Large adjustment confirmation (FR-12)
  let largeConfirmRequired = false;
  try {
    await adjustStock({
      variantId: v1.id,
      mode: "DELTA",
      quantity: 5000,
      reasonCode: ReasonCode.PURCHASE,
      note: "Huge shipment arriving",
      actorId: "tester-1",
      confirmLarge: false,
    });
  } catch (err: any) {
    if (err instanceof PreconditionRequiredError) largeConfirmRequired = true;
  }
  assert(largeConfirmRequired, "Large adjustment (>100 units / >25%) raises PreconditionRequired (428)");

  const adjLarge = await adjustStock({
    variantId: v1.id,
    mode: "DELTA",
    quantity: 200,
    reasonCode: ReasonCode.PURCHASE,
    note: "Bulk restock confirmed",
    actorId: "tester-1",
    confirmLarge: true,
  });
  assert(adjLarge.onHand === 250, "Large adjustment succeeds with explicit confirmLarge: true");

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 3: CONCURRENCY TEST — 100 CONSECUTIVE RUNS (INV-03)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 3: Concurrency Safety (100 Consecutive Runs) (INV-03) ---");
  console.log("  Executing 100 simultaneous 2-order races for 1 available unit...");

  let concurrencySuccessCount = 0;

  for (let i = 1; i <= 100; i++) {
    // Create fresh variant with available = 1
    const raceVariant = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        title: `Race Variant ${i}`,
        sku: `RACE-SKU-${uniqueSuffix}-${i}`,
        price: 100,
        stock: 1,
      },
    });

    await prisma.inventory.create({
      data: {
        variantId: raceVariant.id,
        locationId: location.id,
        onHand: 1,
        reserved: 0,
        lowStockThreshold: 5,
      },
    });

    const orderIdA = `ORDER-RACE-${i}-A`;
    const orderIdB = `ORDER-RACE-${i}-B`;

    // Fire both orders simultaneously
    const results = await Promise.allSettled([
      reserveStock({
        orderId: orderIdA,
        items: [{ variantId: raceVariant.id, quantity: 1 }],
      }),
      reserveStock({
        orderId: orderIdB,
        items: [{ variantId: raceVariant.id, quantity: 1 }],
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one must succeed and one must fail
    const exactlyOneWon = fulfilled.length === 1 && rejected.length === 1;

    // Check inventory state: reserved must be 1, onHand must be 1, available must be 0 (never negative)
    const finalInv = await prisma.inventory.findUnique({
      where: {
        variantId_locationId: {
          variantId: raceVariant.id,
          locationId: location.id,
        },
      },
    });

    const invariantsHold =
      finalInv?.onHand === 1 &&
      finalInv?.reserved === 1 &&
      finalInv.onHand - finalInv.reserved === 0;

    if (exactlyOneWon && invariantsHold) {
      concurrencySuccessCount++;
    }
  }

  assert(
    concurrencySuccessCount === 100,
    `100 consecutive runs of concurrent race passed (Score: ${concurrencySuccessCount}/100)`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 4: FULFILMENT CONSUMPTION & INVARIANT PRESERVATION (INV-04)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 4: Fulfilment Consumption (INV-04) ---");

  const vF = await prisma.productVariant.create({
    data: {
      productId: testProduct.id,
      title: "Fulfilment Test Variant",
      sku: `FULFIL-SKU-${uniqueSuffix}`,
      price: 200,
      stock: 22,
    },
  });

  await prisma.inventory.create({
    data: {
      variantId: vF.id,
      locationId: location.id,
      onHand: 22,
      reserved: 0,
      lowStockThreshold: 5,
    },
  });

  const testOrderId891 = `ORD-891-${uniqueSuffix}`;

  // Reserve 4 units for order 891
  await reserveStock({
    orderId: testOrderId891,
    items: [{ variantId: vF.id, quantity: 4 }],
  });

  let invState = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: vF.id, locationId: location.id } },
  });
  assert(invState?.onHand === 22, "Before fulfilment: on_hand is 22");
  assert(invState?.reserved === 4, "Before fulfilment: reserved is 4");
  assert(invState!.onHand - invState!.reserved === 18, "Before fulfilment: available is 18");

  // Fulfil (ship) 2 of those units
  const fulfilRes = await fulfilStock({
    orderId: testOrderId891,
    items: [{ variantId: vF.id, quantity: 2 }],
  });
  assert(fulfilRes.success, "Fulfilment succeeds");

  invState = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: vF.id, locationId: location.id } },
  });
  assert(invState?.onHand === 20, "After fulfilment: on_hand decremented by 2 to 20");
  assert(invState?.reserved === 2, "After fulfilment: reserved decremented by 2 to 2");
  assert(
    invState!.onHand - invState!.reserved === 18,
    "CRITICAL INVARIANT: available is 18 — UNCHANGED after fulfilment"
  );

  // Idempotency: second call with same orderId does not double decrement
  const retryFulfil = await fulfilStock({
    orderId: testOrderId891,
    items: [{ variantId: vF.id, quantity: 2 }],
  });
  assert(retryFulfil.alreadyFulfilled === true, "Duplicate fulfilment call is recognized as idempotent");

  const invStatePostRetry = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: vF.id, locationId: location.id } },
  });
  assert(invStatePostRetry?.onHand === 20, "Idempotent fulfilment leaves on_hand unchanged at 20");

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 5: CANCELLATION & TIMEOUT RELEASE (INV-05)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 5: Cancellation & Timeout Release (INV-05) ---");

  // Order with 2 reserved units remaining
  const cancelRes = await releaseStock({
    orderId: testOrderId891,
    items: [{ variantId: vF.id, quantity: 2 }],
    reason: "Customer cancelled",
  });
  assert(cancelRes.success, "Release stock succeeds");

  invState = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: vF.id, locationId: location.id } },
  });
  assert(invState?.reserved === 0, "Cancelled order releases reservation to 0");
  assert(invState?.onHand === 20, "On hand remains 20");
  assert(invState!.onHand - invState!.reserved === 20, "Available returns to 20");

  // Stale unconfirmed reservation expiry
  const vStale = await prisma.productVariant.create({
    data: {
      productId: testProduct.id,
      title: "Stale Order Variant",
      sku: `STALE-SKU-${uniqueSuffix}`,
      price: 300,
      stock: 10,
    },
  });
  await prisma.inventory.create({
    data: {
      variantId: vStale.id,
      locationId: location.id,
      onHand: 10,
      reserved: 0,
      lowStockThreshold: 5,
    },
  });

  const testUser = await prisma.user.findFirst();
  const staleOrder = await prisma.order.create({
    data: {
      userId: testUser?.id || "test-user",
      status: "PENDING",
      totalAmount: 300,
      paymentMethod: "RAZORPAY",
      deliveryZone: "PAN_INDIA",
      shippingAddress: "{}",
      createdAt: new Date(Date.now() - 65 * 60 * 1000), // 65 minutes ago
      items: {
        create: [
          {
            productId: testProduct.id,
            variantId: vStale.id,
            quantity: 3,
            price: 300,
          },
        ],
      },
    },
  });

  await reserveStock({
    orderId: staleOrder.id,
    items: [{ variantId: vStale.id, quantity: 3 }],
  });

  // Run auto-release job with 60 minute window
  const timeoutRes = await releaseExpiredReservations(60);
  assert(
    timeoutRes.releasedOrderIds.includes(staleOrder.id),
    "Stale order older than 60m is auto-released by timeout job"
  );

  const staleOrderAfter = await prisma.order.findUnique({ where: { id: staleOrder.id } });
  assert(staleOrderAfter?.status === "CANCELLED", "Stale order status updated to CANCELLED");

  const staleInvAfter = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: vStale.id, locationId: location.id } },
  });
  assert(staleInvAfter?.reserved === 0, "Stale reservation released back to 0");
  assert(staleInvAfter?.onHand === 10, "On hand remains 10");

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 6: FULL LIFECYCLE INVARIANT SWEEP
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 6: Full Lifecycle Invariant Sweep ---");

  const vLife = await prisma.productVariant.create({
    data: {
      productId: testProduct.id,
      title: "Lifecycle Variant",
      sku: `LIFE-SKU-${uniqueSuffix}`,
      price: 150,
      stock: 0,
    },
  });
  const invLife = await getOrCreateInventory(vLife.id, location.id);

  const orderLifeId = `ORD-LIFE-1-${uniqueSuffix}`;
  const shipLifeId = `SHIP-LIFE-1-${uniqueSuffix}`;

  // Step 1: Restock purchase +20
  await adjustStock({
    variantId: vLife.id,
    mode: "DELTA",
    quantity: 20,
    reasonCode: ReasonCode.PURCHASE,
    actorId: "tester",
  });
  let cur = await prisma.inventory.findUnique({
    where: { id: invLife.id },
  });
  assert(cur!.onHand - cur!.reserved === 20, "Step 1 (Restock): available = 20 (on_hand 20 - reserved 0)");

  // Step 2: Order placement reserve 5
  await reserveStock({
    orderId: orderLifeId,
    items: [{ variantId: vLife.id, quantity: 5 }],
  });
  cur = await prisma.inventory.findUnique({ where: { id: invLife.id } });
  assert(cur!.onHand - cur!.reserved === 15, "Step 2 (Reserve 5): available = 15 (on_hand 20 - reserved 5)");

  // Step 3: Partial fulfilment 3
  await fulfilStock({
    orderId: orderLifeId,
    items: [{ variantId: vLife.id, quantity: 3 }],
  });
  cur = await prisma.inventory.findUnique({ where: { id: invLife.id } });
  assert(cur!.onHand - cur!.reserved === 15, "Step 3 (Fulfil 3): available = 15 (on_hand 17 - reserved 2)");

  // Step 4: Cancel remaining 2
  await releaseStock({
    orderId: orderLifeId,
    items: [{ variantId: vLife.id, quantity: 2 }],
  });
  cur = await prisma.inventory.findUnique({ where: { id: invLife.id } });
  assert(cur!.onHand - cur!.reserved === 17, "Step 4 (Cancel 2): available = 17 (on_hand 17 - reserved 0)");

  // Step 5: RTO return of 1 previously fulfilled unit
  await restoreRtoStock({
    shipmentId: shipLifeId,
    items: [{ variantId: vLife.id, quantity: 1, isDamaged: false }],
    actorId: "operator-1",
  });
  cur = await prisma.inventory.findUnique({ where: { id: invLife.id } });
  assert(cur!.onHand - cur!.reserved === 18, "Step 5 (RTO 1): available = 18 (on_hand 18 - reserved 0)");

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 7: DATABASE TRIGGERS & LEDGER IMMUTABILITY (INV-06)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 7: Database Triggers & Ledger Immutability (INV-06) ---");

  const anyMovement = await prisma.inventoryMovement.findFirst();
  assert(anyMovement !== null, "InventoryMovement records exist");

  // Attempt direct UPDATE on InventoryMovement
  let updateRejectedByTrigger = false;
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE InventoryMovement
      SET quantityDelta = 999
      WHERE id = '${anyMovement?.id}'
    `);
  } catch (err: any) {
    updateRejectedByTrigger = true;
  }
  assert(updateRejectedByTrigger, "Database trigger rejects direct UPDATE on InventoryMovement");

  // Attempt direct DELETE on InventoryMovement
  let deleteRejectedByTrigger = false;
  try {
    await prisma.$executeRawUnsafe(`
      DELETE FROM InventoryMovement
      WHERE id = '${anyMovement?.id}'
    `);
  } catch (err: any) {
    deleteRejectedByTrigger = true;
  }
  assert(deleteRejectedByTrigger, "Database trigger rejects direct DELETE on InventoryMovement");

  // Reconcile running balance down for variant
  const movements = await prisma.inventoryMovement.findMany({
    where: { variantId: vLife.id },
    orderBy: { createdAt: "desc" },
  });
  assert(movements.length > 0, "Ledger contains history for variant");
  assert(movements[0].onHandAfter === cur?.onHand, "Newest ledger balance matches current physical on-hand");

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 8: LOW STOCK ALERTS LIFECYCLE (INV-07)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 8: Low Stock Alerts Lifecycle (INV-07) ---");

  const vAlert = await prisma.productVariant.create({
    data: {
      productId: testProduct.id,
      title: "Alert Variant",
      sku: `ALERT-SKU-${uniqueSuffix}`,
      price: 100,
      stock: 6,
    },
  });
  await prisma.inventory.create({
    data: {
      variantId: vAlert.id,
      locationId: location.id,
      onHand: 6,
      reserved: 0,
      lowStockThreshold: 5,
    },
  });

  // Cross threshold downward: available 6 -> 4
  await adjustStock({
    variantId: vAlert.id,
    mode: "DELTA",
    quantity: -2,
    reasonCode: ReasonCode.CORRECTION,
    note: "Routine audit reduction",
    actorId: "tester",
  });

  const alerts1 = await prisma.stockAlert.findMany({
    where: { variantId: vAlert.id, resolvedAt: null },
  });
  assert(alerts1.length === 1, "Crossing threshold downward creates exactly 1 active alert");
  assert(alerts1[0].alertType === StockAlertTypes.LOW_STOCK, "Alert type is LOW_STOCK");

  // Reduce further: available 4 -> 3
  await adjustStock({
    variantId: vAlert.id,
    mode: "DELTA",
    quantity: -1,
    reasonCode: ReasonCode.CORRECTION,
    note: "Another piece written off",
    actorId: "tester",
  });

  const alerts2 = await prisma.stockAlert.findMany({
    where: { variantId: vAlert.id, resolvedAt: null },
  });
  assert(alerts2.length === 1, "Reducing further while low does NOT raise duplicate alert");

  // Restock above threshold: available 3 -> 20
  await adjustStock({
    variantId: vAlert.id,
    mode: "DELTA",
    quantity: 17,
    reasonCode: ReasonCode.PURCHASE,
    actorId: "tester",
    confirmLarge: true,
  });

  const alertsResolved = await prisma.stockAlert.findMany({
    where: { variantId: vAlert.id, resolvedAt: { not: null } },
  });
  assert(alertsResolved.length >= 1, "Restocking above threshold resolves the alert");

  // Reduce to 0: raises distinct OUT_OF_STOCK alert
  await adjustStock({
    variantId: vAlert.id,
    mode: "DELTA",
    quantity: -20,
    reasonCode: ReasonCode.CORRECTION,
    note: "All inventory transferred out",
    actorId: "tester",
    confirmLarge: true,
  });

  const outAlert = await prisma.stockAlert.findFirst({
    where: { variantId: vAlert.id, resolvedAt: null },
  });
  assert(outAlert?.alertType === StockAlertTypes.OUT_OF_STOCK, "Reaching available 0 raises OUT_OF_STOCK alert");

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 9: RTO SYSTEM RETURN (INV-13)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 9: RTO System Return (INV-13) ---");

  const vRto = await prisma.productVariant.create({
    data: {
      productId: testProduct.id,
      title: "RTO Test Variant",
      sku: `RTO-SKU-${uniqueSuffix}`,
      price: 200,
      stock: 10,
    },
  });
  await prisma.inventory.create({
    data: {
      variantId: vRto.id,
      locationId: location.id,
      onHand: 10,
      reserved: 0,
      lowStockThreshold: 5,
    },
  });

  // Clean parcel return
  const rto1 = await restoreRtoStock({
    shipmentId: `SHIP-RTO-${uniqueSuffix}-1`,
    items: [{ variantId: vRto.id, quantity: 2, isDamaged: false }],
    actorId: "warehouse-person",
    actorName: "Sanjay",
  });
  assert(rto1.success, "RTO restore returns success");

  let rtoInv = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: vRto.id, locationId: location.id } },
  });
  assert(rtoInv?.onHand === 12, "RTO increases on_hand by 2 to 12");
  assert(rtoInv?.reserved === 0, "RTO leaves reserved untouched at 0");

  const rtoMovement = await prisma.inventoryMovement.findFirst({
    where: { referenceType: "SHIPMENT", referenceId: `SHIP-RTO-${uniqueSuffix}-1` },
  });
  assert(rtoMovement?.movementType === MovementType.RETURN, "RTO creates movement with type RETURN");
  assert(rtoMovement?.createdBy === "Sanjay", "RTO records physical receiving operator name");

  // Damaged parcel return: restores on-hand then writes off damage
  await restoreRtoStock({
    shipmentId: `SHIP-RTO-${uniqueSuffix}-2`,
    items: [
      {
        variantId: vRto.id,
        quantity: 1,
        isDamaged: true,
        damageNote: "Crushed carton on arrival",
      },
    ],
    actorId: "warehouse-person",
    actorName: "Sanjay",
  });

  rtoInv = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: vRto.id, locationId: location.id } },
  });
  assert(rtoInv?.onHand === 12, "Damaged RTO restores then immediately writes off, leaving sellable at 12");

  const damageMov = await prisma.inventoryMovement.findFirst({
    where: { referenceId: `SHIP-RTO-${uniqueSuffix}-2`, reasonCode: ReasonCode.DAMAGE },
  });
  assert(damageMov !== null, "Damaged RTO automatically records accompanying DAMAGE movement");

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 10: BULK ADJUSTMENT & 60-SECOND COMPENSATING UNDO (INV-09)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 10: Bulk Adjustment & Compensating Undo (INV-09) ---");

  const vBulk1 = await prisma.productVariant.create({
    data: {
      productId: testProduct.id,
      title: "Bulk 1",
      sku: `BULK-1-${uniqueSuffix}`,
      price: 100,
      stock: 10,
    },
  });
  const vBulk2 = await prisma.productVariant.create({
    data: {
      productId: testProduct.id,
      title: "Bulk 2",
      sku: `BULK-2-${uniqueSuffix}`,
      price: 100,
      stock: 20,
    },
  });

  await prisma.inventory.create({
    data: { variantId: vBulk1.id, locationId: location.id, onHand: 10, reserved: 0 },
  });
  await prisma.inventory.create({
    data: { variantId: vBulk2.id, locationId: location.id, onHand: 20, reserved: 0 },
  });

  // Dry Run Preview
  const dryRun = await bulkAdjustStock({
    adjustments: [
      { variantId: vBulk1.id, quantity: 50 },
      { variantId: vBulk2.id, quantity: 30 },
    ],
    mode: "DELTA",
    reasonCode: ReasonCode.PURCHASE,
    dryRun: true,
    actorId: "tester",
  });
  assert((dryRun as any).dryRun === true, "Dry run preview flag is true");
  assert(dryRun.totalDelta === 80, "Dry run computes net total delta +80");

  // Commit batch
  const commitRes = await bulkAdjustStock({
    adjustments: [
      { variantId: vBulk1.id, quantity: 50 },
      { variantId: vBulk2.id, quantity: 30 },
    ],
    mode: "DELTA",
    reasonCode: ReasonCode.PURCHASE,
    dryRun: false,
    actorId: "tester",
  });
  assert((commitRes as any).success === true, "Bulk adjust commit succeeds");

  const b1Post = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: vBulk1.id, locationId: location.id } },
  });
  const b2Post = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: vBulk2.id, locationId: location.id } },
  });
  assert(b1Post?.onHand === 60, "Bulk SKU 1 on_hand becomes 60");
  assert(b2Post?.onHand === 50, "Bulk SKU 2 on_hand becomes 50");

  // Compensating Undo
  const undoRes = await undoBulkAdjust(commitRes.batchId, "tester", "Tester");
  assert(undoRes.success === true, "Compensating undo succeeds");

  const b1Reverted = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: vBulk1.id, locationId: location.id } },
  });
  const b2Reverted = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: vBulk2.id, locationId: location.id } },
  });
  assert(b1Reverted?.onHand === 10, "SKU 1 restored to pre-batch level 10");
  assert(b2Reverted?.onHand === 20, "SKU 2 restored to pre-batch level 20");

  // Verify append-only: original batch movements still exist in ledger
  const originalMovements = await prisma.inventoryMovement.findMany({
    where: { batchId: commitRes.batchId },
  });
  assert(originalMovements.length === 2, "Original ledger movements remain untouched (strictly append-only)");

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 11: CSV STOCK TAKE IMPORT (INV-10)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 11: CSV Stock Take Import (INV-10) ---");

  const csvRows = [
    { sku: `BULK-1-${uniqueSuffix}`, countedQty: 15 }, // was 10 -> variance +5
    { sku: `BULK-2-${uniqueSuffix}`, countedQty: 10 }, // was 20 -> variance -10 (-50% > 20% threshold)
    { sku: "UNKNOWN-SKU-999", countedQty: 50 }, // Missing SKU
  ];

  const importPreview = await importStockCsv(csvRows, "tester", "Tester");
  assert(importPreview.validRowsCount === 2, "Valid rows counted as 2");
  assert(importPreview.errorRowsCount === 1, "Missing SKU reported in errorRows");
  assert(importPreview.errorRows[0].sku === "UNKNOWN-SKU-999", "Error reports 'UNKNOWN-SKU-999'");
  assert(importPreview.flaggedCount >= 1, "High variance row (>20%) is flagged for review");

  console.log("\n===============================================================================");
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log("===============================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllSuites()
  .catch((e) => {
    console.error("Test execution threw fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
