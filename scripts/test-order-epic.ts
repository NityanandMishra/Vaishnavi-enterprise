import { prisma } from "../src/lib/db";
import {
  transitionOrderStatus,
  cancelOrder,
  cancelOrderLine,
  updateOrderShippingAddress,
  dispatchOrderShipment,
  deliverOrder,
  generateOrderNumber,
  calculateSlaDueAt,
  createManualOrder,
  OrderTransitionError,
} from "../src/lib/orders/order-service";
import { generateOrderInvoice } from "../src/lib/orders/invoice-generator";
import { resolveShippingRate } from "../src/lib/orders/shipping-resolver";
import { getDefaultLocation } from "../src/lib/inventory/inventory-service";

async function runOrderEpicTests() {
  console.log("================================================================================");
  console.log("  VAISHNAVI ENTERPRISES — EPIC-05 ORDER MANAGEMENT (ORD) VERIFICATION SUITE");
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

  // Setup: Ensure location, product, variants, and stock
  const loc = await getDefaultLocation();

  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: { name: "Order Test Category", slug: `ord-cat-${Date.now()}` },
    });
  }

  // Create test product with 2 variants
  const testProduct = await prisma.product.create({
    data: {
      title: "Cotton Kurta Set",
      slug: `cotton-kurta-${Date.now()}`,
      description: "Traditional pure cotton kurta set",
      basePrice: 899.0,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      categoryId: category.id,
      hsnCode: "6109",
      gstRate: 12.0,
    },
  });

  const variantRedM = await prisma.productVariant.create({
    data: {
      productId: testProduct.id,
      title: "Red / M",
      sku: `VE-APP-KUR-RED-M-${Date.now()}`,
      price: 899.0,
      stock: 50,
    },
  });

  const variantTurmeric = await prisma.productVariant.create({
    data: {
      productId: testProduct.id,
      title: "Turmeric Powder 500g",
      sku: `VE-SPI-TUR-500-${Date.now()}`,
      price: 199.0,
      stock: 30,
    },
  });

  // Seed inventory records
  const invRed = await prisma.inventory.upsert({
    where: { variantId_locationId: { variantId: variantRedM.id, locationId: loc.id } },
    create: { variantId: variantRedM.id, locationId: loc.id, onHand: 50, reserved: 0 },
    update: { onHand: 50, reserved: 0 },
  });

  const invTurmeric = await prisma.inventory.upsert({
    where: { variantId_locationId: { variantId: variantTurmeric.id, locationId: loc.id } },
    create: { variantId: variantTurmeric.id, locationId: loc.id, onHand: 30, reserved: 0 },
    update: { onHand: 30, reserved: 0 },
  });

  console.log("[Setup] Created test products and inventories successfully.\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: State Machine Legal & Illegal Transitions (ORD-03)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- TEST 1: State Machine Legal & Illegal Transitions (ORD-03) ---");

  const orderNum1 = await generateOrderNumber();
  const testOrder1 = await prisma.order.create({
    data: {
      id: crypto.randomUUID(),
      orderNumber: orderNum1,
      source: "WEB",
      status: "PENDING",
      paymentStatus: "PAID",
      paymentMethod: "UPI",
      subtotalAmount: 1798.0,
      totalAmount: 2013.76,
      paidAmount: 2013.76,
      balanceAmount: 0,
      shippingAddress: JSON.stringify({
        fullName: "Amrit Suthar",
        phone: "9820011111",
        addressLine1: "Flat 101, Main Road",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
      }),
      deliveryStateCode: "27",
      items: {
        create: [
          {
            productId: testProduct.id,
            variantId: variantRedM.id,
            productName: "Cotton Kurta Set",
            variantTitle: "Red / M",
            sku: variantRedM.sku,
            quantity: 2,
            price: 899.0,
            hsnCode: "6109",
            gstRate: 12.0,
            taxableValue: 1605.36,
            cgstAmount: 96.32,
            sgstAmount: 96.32,
            igstAmount: 0,
            lineTotal: 1798.0,
          },
        ],
      },
    },
  });

  // 1a. Illegal transition: PENDING -> PACKED directly
  try {
    await transitionOrderStatus(testOrder1.id, { toStatus: "PACKED", actor: "Test" });
    assert(false, "PENDING -> PACKED should be rejected as ILLEGAL_TRANSITION");
  } catch (err: any) {
    assert(err.error === "ILLEGAL_TRANSITION", "PENDING -> PACKED correctly rejected with 409 ILLEGAL_TRANSITION");
    assert(err.details.legalNext.includes("CONFIRMED"), "Error details correctly named legalNext options");
  }

  // 1b. Legal: PENDING -> CONFIRMED
  const resConf = await transitionOrderStatus(testOrder1.id, { toStatus: "CONFIRMED", actor: "Test" });
  assert(resConf.order.status === "CONFIRMED", "PENDING -> CONFIRMED succeeded");
  assert(resConf.order.confirmedAt !== null, "confirmedAt timestamp populated");

  // 1c. Legal: CONFIRMED -> PROCESSING
  const resProc = await transitionOrderStatus(testOrder1.id, { toStatus: "PROCESSING", actor: "Test" });
  assert(resProc.order.status === "PROCESSING", "CONFIRMED -> PROCESSING succeeded");

  // 1d. Legal: PROCESSING -> PACKED
  const resPack = await transitionOrderStatus(testOrder1.id, { toStatus: "PACKED", actor: "Test" });
  assert(resPack.order.status === "PACKED", "PROCESSING -> PACKED succeeded");

  // 1e. Revert PACKED -> PROCESSING requires a reason
  try {
    await transitionOrderStatus(testOrder1.id, { toStatus: "PROCESSING", reason: "", actor: "Test" });
    assert(false, "Reverting to PROCESSING without reason should be rejected");
  } catch (err: any) {
    assert(err.error === "REASON_REQUIRED", "Reverting without reason correctly rejected with REASON_REQUIRED");
  }

  // 1f. Revert with reason succeeds
  const resRevert = await transitionOrderStatus(testOrder1.id, {
    toStatus: "PROCESSING",
    reason: "Needs repackaging in bigger box",
    actor: "Test",
  });
  assert(resRevert.order.status === "PROCESSING", "Reverting with reason succeeded");

  // Move back to PACKED
  await transitionOrderStatus(testOrder1.id, { toStatus: "PACKED", actor: "Test" });

  // 1g. CRITICAL: Manual transition PACKED -> SHIPPED is REJECTED (A.4 System-Only Guard)
  try {
    await transitionOrderStatus(testOrder1.id, { toStatus: "SHIPPED", actor: "Operator", isSystem: false });
    assert(false, "Manual PACKED -> SHIPPED status change must be rejected as SYSTEM_ONLY_TRANSITION");
  } catch (err: any) {
    assert(
      err.error === "SYSTEM_ONLY_TRANSITION",
      "Manual PACKED -> SHIPPED rejected with 409 SYSTEM_ONLY_TRANSITION (guard against double stock consumption)"
    );
  }

  // 1h. Transition to RETURNED in v1 is REJECTED
  try {
    await transitionOrderStatus(testOrder1.id, { toStatus: "RETURNED", actor: "Operator" });
    assert(false, "Transition to RETURNED should be rejected in v1");
  } catch (err: any) {
    assert(err.error === "RETURN_FLOW_NOT_AVAILABLE", "RETURNED transition rejected with RETURN_FLOW_NOT_AVAILABLE");
  }

  console.log("\n--- TEST 2: Shipment Dispatch, Stock Consumption & Invoicing (ORD-03, ORD-11, INV-04) ---");

  // Initial stock before dispatch
  const initialInv = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: variantRedM.id, locationId: loc.id } },
  });
  // Reserve 2 units first to simulate active reservation
  await prisma.inventory.update({
    where: { id: initialInv!.id },
    data: { reserved: 2 },
  });

  const onHandBefore = initialInv!.onHand;

  // Dispatch shipment via Module 07 action
  const dispatchRes = await dispatchOrderShipment(testOrder1.id, {
    carrier: "Delhivery",
    awb: "DELH123456789",
    actor: "Amrit Suthar",
  });

  assert(dispatchRes.status === "SHIPPED", "Order successfully transitioned to SHIPPED via shipment dispatch");
  assert(dispatchRes.invoice !== undefined, "GST tax invoice automatically generated on transition to SHIPPED");

  // Verify stock consumed (on_hand decrements, reserved decrements, available unchanged)
  const postInv = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: variantRedM.id, locationId: loc.id } },
  });
  assert(postInv!.onHand === onHandBefore - 2, `Stock onHand consumed: ${onHandBefore} -> ${postInv!.onHand}`);
  assert(postInv!.reserved === 0, "Stock reserved reset to 0 after fulfilment");

  // Verify Gapless Invoice Format
  assert(
    /^VE\/\d{2}-\d{2}\/\d{4}$/.test(dispatchRes.invoice.invoiceNumber),
    `Invoice number follows VE/YY-YY/XXXX gapless format: "${dispatchRes.invoice.invoiceNumber}"`
  );

  // Attempt duplicate invoice generation returns existing record (immutable)
  const dupInvoice = await generateOrderInvoice(testOrder1.id);
  assert(dupInvoice.alreadyExisted === true, "Invoice is immutable: duplicate call returned existing record");
  assert(dupInvoice.invoice.invoiceNumber === dispatchRes.invoice.invoiceNumber, "Invoice number matches original");

  // Verify SHIPPED order CANNOT be cancelled (stock has left the building)
  try {
    await cancelOrder(testOrder1.id, { reason: "Customer request", actor: "Test" });
    assert(false, "SHIPPED order must NOT be cancellable");
  } catch (err: any) {
    assert(err.error === "ILLEGAL_TRANSITION", "Cancelling SHIPPED order rejected with 409 ILLEGAL_TRANSITION");
  }

  // Delivery: courier event marks DELIVERED
  const deliverRes = await deliverOrder(testOrder1.id);
  assert(deliverRes.order.status === "DELIVERED", "Order transitioned to DELIVERED on courier event");
  assert(deliverRes.order.deliveredAt !== null, "deliveredAt timestamp recorded");

  console.log("\n--- TEST 3: Financial Immutability (FI-01, FI-02, ORD-02) ---");

  // Create an order line for "Cotton Kurta Set" at ₹899.00
  const orderNum2 = await generateOrderNumber();
  const immutOrder = await prisma.order.create({
    data: {
      id: crypto.randomUUID(),
      orderNumber: orderNum2,
      source: "WEB",
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "UPI",
      subtotalAmount: 899.0,
      totalAmount: 1006.88,
      paidAmount: 1006.88,
      balanceAmount: 0,
      shippingAddress: JSON.stringify({ fullName: "Rajesh Kumar", pincode: "400001", state: "Maharashtra" }),
      items: {
        create: [
          {
            productId: testProduct.id,
            variantId: variantRedM.id,
            productName: "Cotton Kurta Set",
            variantTitle: "Red / M",
            sku: variantRedM.sku,
            quantity: 1,
            price: 899.0,
            hsnCode: "6109",
            gstRate: 12.0,
            taxableValue: 802.68,
            cgstAmount: 48.16,
            sgstAmount: 48.16,
            igstAmount: 0,
            lineTotal: 899.0,
          },
        ],
      },
    },
  });

  // Mutate product title and price in database to simulate live changes
  await prisma.product.update({
    where: { id: testProduct.id },
    data: {
      title: "Premium Cotton Kurta",
      basePrice: 949.0,
    },
  });

  // Read order back and verify snapshot integrity
  const fetchedOrder = await prisma.order.findUnique({
    where: { id: immutOrder.id },
    include: { items: true },
  });

  assert(
    fetchedOrder!.items[0].productName === "Cotton Kurta Set",
    "Line product name is preserved snapshot ('Cotton Kurta Set', not 'Premium Cotton Kurta')"
  );
  assert(
    fetchedOrder!.items[0].price === 899.0,
    "Line unit price is preserved snapshot (₹899.00, not ₹949.00)"
  );
  assert(
    fetchedOrder!.items[0].hsnCode === "6109" && fetchedOrder!.items[0].gstRate === 12.0,
    "Line HSN and GST rate are preserved placement snapshots"
  );

  console.log("\n--- TEST 4: Order Cancellation & Stock Release (ORD-04, INV-05) ---");

  // Create order with 3 units reserved
  const orderNum3 = await generateOrderNumber();
  const cancelTestOrder = await prisma.order.create({
    data: {
      id: crypto.randomUUID(),
      orderNumber: orderNum3,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "UPI",
      subtotalAmount: 2697.0,
      totalAmount: 3020.64,
      paidAmount: 3020.64,
      balanceAmount: 0,
      shippingAddress: JSON.stringify({ fullName: "Priya Shah", pincode: "400001", state: "Maharashtra" }),
      items: {
        create: [
          {
            productId: testProduct.id,
            variantId: variantRedM.id,
            productName: "Cotton Kurta Set",
            variantTitle: "Red / M",
            sku: variantRedM.sku,
            quantity: 3,
            price: 899.0,
            hsnCode: "6109",
            gstRate: 12.0,
            lineTotal: 2697.0,
          },
        ],
      },
    },
  });

  // Set reserved stock to 3
  await prisma.inventory.update({
    where: { variantId_locationId: { variantId: variantRedM.id, locationId: loc.id } },
    data: { reserved: 3 },
  });

  const cancelResult = await cancelOrder(cancelTestOrder.id, {
    reason: "Customer request",
    note: "Customer cancelled before packing",
    actor: "Amrit Suthar",
    notifyCustomer: true,
  });

  assert(cancelResult.order.status === "CANCELLED", "Order status updated to CANCELLED");
  assert(cancelResult.order.cancellationReason === "Customer request", "Cancellation reason recorded");
  assert(cancelResult.refundDueAmount === 3020.64, "Refund due flagged for ₹3,020.64 without auto-debit");

  // Verify stock reservation released
  const invAfterCancel = await prisma.inventory.findUnique({
    where: { variantId_locationId: { variantId: variantRedM.id, locationId: loc.id } },
  });
  assert(invAfterCancel!.reserved === 0, "Stock reserved decremented from 3 -> 0 back to available");

  console.log("\n--- TEST 5: Line-Level Cancellation (ORD-05) ---");

  // Create order with 2 lines: Line 1 (Kurta ₹899), Line 2 (Turmeric ₹199)
  const orderNum4 = await generateOrderNumber();
  const multiLineOrder = await prisma.order.create({
    data: {
      id: crypto.randomUUID(),
      orderNumber: orderNum4,
      status: "PROCESSING",
      paymentStatus: "PAID",
      paymentMethod: "UPI",
      subtotalAmount: 1098.0,
      taxAmount: 127.88,
      totalAmount: 1225.88,
      paidAmount: 1225.88,
      balanceAmount: 0,
      shippingAddress: JSON.stringify({ fullName: "Sneha Patel", pincode: "400001", state: "Maharashtra" }),
      items: {
        create: [
          {
            productId: testProduct.id,
            variantId: variantRedM.id,
            productName: "Cotton Kurta Set",
            variantTitle: "Red / M",
            sku: variantRedM.sku,
            quantity: 1,
            price: 899.0,
            hsnCode: "6109",
            gstRate: 12.0,
            cgstAmount: 48.16,
            sgstAmount: 48.16,
            igstAmount: 0,
            lineTotal: 899.0,
            status: "ACTIVE",
          },
          {
            productId: testProduct.id,
            variantId: variantTurmeric.id,
            productName: "Turmeric Powder 500g",
            variantTitle: "500g",
            sku: variantTurmeric.sku,
            quantity: 1,
            price: 199.0,
            hsnCode: "0910",
            gstRate: 5.0,
            cgstAmount: 4.98,
            sgstAmount: 4.98,
            igstAmount: 0,
            lineTotal: 199.0,
            status: "ACTIVE",
          },
        ],
      },
    },
    include: { items: true },
  });

  const turmericLine = multiLineOrder.items.find((i) => i.price === 199.0)!;

  // Cancel turmeric line
  const lineCancelRes = await cancelOrderLine(multiLineOrder.id, turmericLine.id, {
    reason: "Out of stock",
    actor: "Warehouse Ops",
  });

  assert(lineCancelRes.success === true, "Line cancellation completed successfully");

  // Verify adjustment record inserted
  const adjustment = await prisma.orderLineAdjustment.findFirst({
    where: { orderItemId: turmericLine.id },
  });
  assert(adjustment !== null, "OrderLineAdjustment record inserted");
  assert(adjustment!.adjustmentType === "CANCELLATION", "Adjustment type is CANCELLATION");
  assert(adjustment!.amount === 199.0, "Adjustment base amount matches ₹199.00");

  // Verify line is struck-through/marked CANCELLED without mutating original line price
  const updatedLine = await prisma.orderItem.findUnique({
    where: { id: turmericLine.id },
  });
  assert(updatedLine!.status === "CANCELLED", "Line status marked CANCELLED");
  assert(updatedLine!.price === 199.0, "Original line unit price is completely unchanged (FI-01)");

  // Verify order total reduced
  const updatedMultiOrder = await prisma.order.findUnique({
    where: { id: multiLineOrder.id },
  });
  assert(
    updatedMultiOrder!.totalAmount < 1225.88,
    `Order total adjusted downwards: ₹1,225.88 -> ₹${updatedMultiOrder!.totalAmount.toFixed(2)}`
  );
  assert(
    updatedMultiOrder!.refundDueAmount > 0,
    `Partial refund due flagged: ₹${updatedMultiOrder!.refundDueAmount.toFixed(2)}`
  );

  console.log("\n--- TEST 6: Address Editing & Tax Reallocation (FI-04a, ORD-07) ---");

  // Create order placed to Maharashtra (intra-state CGST 101.88 + SGST 101.88 = 203.76 total GST)
  const orderNum5 = await generateOrderNumber();
  const addressOrder = await prisma.order.create({
    data: {
      id: crypto.randomUUID(),
      orderNumber: orderNum5,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "UPI",
      subtotalAmount: 1698.0,
      taxAmount: 203.76,
      shippingCost: 35.0, // Mumbai Metro rate
      totalAmount: 1936.76,
      paidAmount: 1936.76,
      balanceAmount: 0,
      deliveryStateCode: "27", // Maharashtra
      deliveryZone: "Mumbai Metro",
      shippingAddress: JSON.stringify({
        fullName: "Rajesh Kumar",
        phone: "9820011111",
        addressLine1: "Flat 402, Sunrise Apartments",
        addressLine2: "MG Road",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
      }),
      items: {
        create: [
          {
            productId: testProduct.id,
            productName: "Cotton Kurta Set",
            variantTitle: "Red / M",
            sku: "VE-APP-KUR-RED-M",
            quantity: 2,
            price: 849.0,
            hsnCode: "6109",
            gstRate: 12.0,
            taxableValue: 1698.0,
            cgstAmount: 101.88,
            sgstAmount: 101.88,
            igstAmount: 0,
            lineTotal: 1901.76,
          },
        ],
      },
    },
  });

  // 6a. Attempt unserviceable pincode (999999) is BLOCKED
  try {
    await updateOrderShippingAddress(addressOrder.id, {
      fullName: "Rajesh Kumar",
      phone: "9820011111",
      addressLine1: "Remote Area",
      city: "Remote",
      state: "Karnataka",
      pincode: "999999",
    });
    assert(false, "Unserviceable pincode 999999 should be blocked");
  } catch (err: any) {
    assert(
      err.message.includes("We do not deliver to 999999 yet"),
      "Blocked with: 'We do not deliver to 999999 yet'"
    );
  }

  // 6b. Change state from Maharashtra to Karnataka (560001, Rest of India zone ₹99)
  const addrUpdateRes = await updateOrderShippingAddress(addressOrder.id, {
    fullName: "Rajesh Kumar",
    phone: "9820011111",
    addressLine1: "Flat 402, Sunrise Apartments",
    addressLine2: "MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
  });

  assert(addrUpdateRes.taxReallocated === true, "Tax split was reallocated on state change");
  assert(
    addrUpdateRes.consequences.taxSplit === "IGST",
    "Tax split converted: CGST + SGST -> IGST"
  );
  assert(
    addrUpdateRes.consequences.totalTaxUnchanged === true,
    "FI-04a invariant: Total tax amount stays unchanged"
  );

  // Check order lines tax allocation
  const checkLines = await prisma.orderItem.findMany({ where: { orderId: addressOrder.id } });
  assert(checkLines[0].cgstAmount === 0 && checkLines[0].sgstAmount === 0, "CGST and SGST set to 0");
  assert(
    checkLines[0].igstAmount === 203.76,
    `IGST holds entire tax amount: ₹${checkLines[0].igstAmount} (was CGST 101.88 + SGST 101.88)`
  );

  // Check shipping re-resolution
  assert(
    addrUpdateRes.consequences.oldShipping === 35 && addrUpdateRes.consequences.newShipping === 99,
    "Shipping re-resolved: Mumbai Metro ₹35 -> Rest of India ₹99"
  );
  assert(
    addrUpdateRes.order.balanceAmount === 64.0,
    "Order total delta (+₹64.00) added as balance due without auto-charging card"
  );

  console.log("\n--- TEST 7: SLA Flagging Engine (ORD-10) ---");

  // SLA calculation tests
  const now = new Date();
  const slaPending = calculateSlaDueAt("PENDING", now);
  const slaConfirmed = calculateSlaDueAt("CONFIRMED", now);
  const slaProcessing = calculateSlaDueAt("PROCESSING", now);
  const slaPacked = calculateSlaDueAt("PACKED", now);
  const slaDelivered = calculateSlaDueAt("DELIVERED", now);

  assert(
    slaPending!.getTime() - now.getTime() === 2 * 60 * 60 * 1000,
    "PENDING SLA is 2 hours"
  );
  assert(
    slaConfirmed!.getTime() - now.getTime() === 8 * 60 * 60 * 1000,
    "CONFIRMED SLA is 8 hours"
  );
  assert(
    slaProcessing!.getTime() - now.getTime() === 12 * 60 * 60 * 1000,
    "PROCESSING SLA is 12 hours"
  );
  assert(
    slaPacked!.getTime() - now.getTime() === 6 * 60 * 60 * 1000,
    "PACKED SLA is 6 hours"
  );
  assert(slaDelivered === null, "DELIVERED is terminal and has no SLA");

  console.log("\n--- TEST 8: Manual Order Creation (ORD-12) ---");

  const manualOrderRes = await createManualOrder({
    customer: {
      name: "Walk-in Customer",
      phone: "9876543210",
      email: "walkin@example.com",
    },
    items: [
      {
        productId: testProduct.id,
        variantId: variantRedM.id,
        quantity: 1,
        unitPrice: 850.0, // Negotiated price deviation from 899.0
      },
    ],
    shippingAddress: {
      fullName: "Walk-in Customer",
      phone: "9876543210",
      addressLine1: "Counter Pick",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    },
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    actor: "Amrit Suthar",
  });

  assert(manualOrderRes.order.source === "MANUAL", "Order created with source = MANUAL");
  assert(manualOrderRes.order.status === "CONFIRMED", "Cash/Paid order enters status CONFIRMED directly");
  assert(
    manualOrderRes.order.items[0].originalPrice === 899.0 && manualOrderRes.order.items[0].price === 850.0,
    "Price override recorded with originalPrice ₹899.00 and price ₹850.00"
  );

  console.log("\n================================================================================");
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runOrderEpicTests()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
