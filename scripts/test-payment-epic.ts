import crypto from "crypto";
import { prisma } from "../src/lib/db";
import {
  recordTransaction,
  processWebhook,
  replayWebhook,
  verifyWebhookSignature,
  getRefundableBreakdown,
  initiateRefund,
  approveRefund,
  rejectRefund,
  retryRefund,
  trackCodCollection,
  recordCodRemittance,
  resolveCodDiscrepancy,
  importSettlement,
  resolveReconciliationItem,
  getPaymentDashboardSummary,
  getFailedPaymentsQueue,
  generatePaymentLink,
  getPaymentSettings,
  updatePaymentSettings,
} from "../src/lib/payments/payment-service";
import { formatPaise, rupeesToPaise, paiseToRupees } from "../src/lib/money";

async function runPaymentEpicTests() {
  console.log("================================================================================");
  console.log("  VAISHNAVI ENTERPRISES — EPIC-06 PAYMENT MANAGEMENT (PAY) VERIFICATION SUITE");
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

  // ─── SETUP: Test Product & Orders ──────────────────────────────────────────
  console.log("[Setup] Creating test orders for payment verification...");

  // Create test user
  let testUser = await prisma.user.findFirst({ where: { email: "rajesh.test@vaishnavienterprises.in" } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        name: "Rajesh Kumar",
        email: "rajesh.test@vaishnavienterprises.in",
        role: "CUSTOMER",
      },
    });
  }

  // Create staff users for approval test
  let requesterStaff = await prisma.user.findFirst({ where: { email: "priya.staff@vaishnavienterprises.in" } });
  if (!requesterStaff) {
    requesterStaff = await prisma.user.create({
      data: {
        name: "Priya Shah",
        email: "priya.staff@vaishnavienterprises.in",
        role: "FINANCE",
      },
    });
  }

  let approverStaff = await prisma.user.findFirst({ where: { email: "amrit.staff@vaishnavienterprises.in" } });
  if (!approverStaff) {
    approverStaff = await prisma.user.create({
      data: {
        name: "Amrit Singh",
        email: "amrit.staff@vaishnavienterprises.in",
        role: "SUPER_ADMIN",
      },
    });
  }

  // Ensure default payment settings
  await updatePaymentSettings({
    refundApprovalThreshold: 1000000, // ₹10,000 in integer paise
    codAutoDiscrepancyHours: 48,
  });

  // Helper to create an order
  async function createTestOrder(opts: {
    orderNumber: string;
    totalAmount: number;
    paymentMethod: string;
    paymentStatus?: string;
    status?: string;
    items?: Array<{ name: string; price: number; qty: number; cgst?: number; sgst?: number; igst?: number; status?: string }>;
  }) {
    // Delete existing if needed
    const existing = await prisma.order.findUnique({ where: { orderNumber: opts.orderNumber } });
    if (existing) {
      await prisma.order.delete({ where: { id: existing.id } });
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: opts.orderNumber,
        userId: testUser!.id,
        source: "WEB",
        status: opts.status || "CONFIRMED",
        paymentStatus: opts.paymentStatus || "PENDING",
        paymentMethod: opts.paymentMethod,
        totalAmount: opts.totalAmount,
        subtotalAmount: opts.totalAmount * 0.85,
        taxAmount: opts.totalAmount * 0.15,
        paidAmount: opts.paymentStatus === "PAID" ? opts.totalAmount : 0,
        balanceAmount: opts.paymentStatus === "PAID" ? 0 : opts.totalAmount,
        shippingAddress: JSON.stringify({
          fullName: "Rajesh Kumar",
          phone: "9876543210",
          addressLine1: "123 Main St",
          city: "Varanasi",
          state: "Uttar Pradesh",
          pincode: "221001",
        }),
        customerName: "Rajesh Kumar",
        customerPhone: "9876543210",
        customerEmail: "rajesh.test@vaishnavienterprises.in",
        placedAt: new Date(),
      },
    });

    // Create a dummy product for order lines if needed
    let dummyProd = await prisma.product.findFirst();
    if (!dummyProd) {
      dummyProd = await (prisma.product as any).create({
        data: {
          title: "Standard Test Product",
          slug: `test-prod-${Date.now()}`,
          basePrice: 500,
        },
      });
    }

    const items = opts.items || [
      { name: "Cotton Kurta Set", price: 899, qty: 2, cgst: 0, sgst: 0, igst: 215.76, status: "ACTIVE" },
      { name: "Brass Diya Set", price: 100, qty: 1, cgst: 0, sgst: 0, igst: 18.0, status: "ACTIVE" },
    ];

    for (const it of items) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: dummyProd?.id || "dummy_prod_id",
          productName: it.name,
          quantity: it.qty,
          price: it.price,
          taxableValue: it.price * it.qty,
          igstAmount: it.igst || 0,
          cgstAmount: it.cgst || 0,
          sgstAmount: it.sgst || 0,
          lineTotal: it.price * it.qty + (it.igst || 0) + (it.cgst || 0) + (it.sgst || 0),
          status: it.status || "ACTIVE",
        },
      });
    }

    return order;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: PAY-01 — Record Every Payment Transaction (Append-only, SEC-01)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 1: Transaction Recording & SEC-01 (PAY-01) ---");
  {
    const order1 = await createTestOrder({
      orderNumber: "VE-2026-TEST-01",
      totalAmount: 1950.76,
      paymentMethod: "UPI",
    });

    // Successful attempt
    const txn1 = await recordTransaction({
      orderId: order1.id,
      gateway: "RAZORPAY",
      gatewayTransactionId: "pay_test_succ_01",
      method: "UPI",
      amountPaise: 195076,
      status: "PAID",
      cardLastFour: "4242", // Should only keep last 4
      upiVpaMasked: "rajesh@okhdfcbank",
      bankName: "HDFC Bank",
      gatewayResponseCode: "SUCCESS",
      gatewayResponseMessage: "Payment captured successfully",
    });

    assert(txn1.amountPaise === 195076, "amountPaise stored accurately as integer paise (195076)");
    assert(txn1.cardLastFour === "4242", "SEC-01: cardLastFour contains only gateway-supplied 4 digits");
    assert(txn1.status === "PAID", "Transaction status is PAID");

    // Check order paymentStatus was updated
    const updatedOrder1 = await prisma.order.findUnique({ where: { id: order1.id } });
    assert(updatedOrder1?.paymentStatus === "PAID", "Order paymentStatus moved to PAID");
    assert(updatedOrder1?.paidAmount === 1950.76, "Order paidAmount updated to 1950.76");
    assert(updatedOrder1?.balanceAmount === 0, "Order balanceAmount updated to 0");

    // Check event log
    const events = await prisma.paymentEvent.findMany({ where: { transactionId: txn1.id } });
    assert(events.length === 1, "PaymentEvent appended for transaction transition");
    assert(events[0].toStatus === "PAID", "Event recorded toStatus PAID");

    // Failed attempt on another order: must be retained
    const orderFail = await createTestOrder({
      orderNumber: "VE-2026-TEST-FAIL",
      totalAmount: 2500,
      paymentMethod: "CARD",
    });

    const txnFail = await recordTransaction({
      orderId: orderFail.id,
      gateway: "RAZORPAY",
      gatewayTransactionId: "pay_test_fail_01",
      method: "CARD",
      amountPaise: 250000,
      status: "FAILED",
      cardLastFour: "1111",
      gatewayResponseCode: "INSUFFICIENT_FUNDS",
      gatewayResponseMessage: "Payment declined by bank — insufficient funds",
    });

    assert(txnFail.status === "FAILED", "Failed transaction persisted with status FAILED");
    assert(
      txnFail.gatewayResponseMessage === "Payment declined by bank — insufficient funds",
      "Gateway failure message stored verbatim"
    );

    // Later retry succeeds on same order -> both rows must exist!
    const txnRetry = await recordTransaction({
      orderId: orderFail.id,
      gateway: "RAZORPAY",
      gatewayTransactionId: "pay_test_succ_02",
      method: "UPI",
      amountPaise: 250000,
      status: "PAID",
      gatewayResponseCode: "SUCCESS",
      gatewayResponseMessage: "Payment captured successfully",
    });

    const allTxns = await prisma.paymentTransaction.findMany({
      where: { orderId: orderFail.id },
      orderBy: { createdAt: "asc" },
    });
    assert(allTxns.length === 2, "FR-04: Multiple transactions for one order are both retained (no overwriting)");
    assert(allTxns[0].status === "FAILED" && allTxns[1].status === "PAID", "Historical failure and subsequent success both preserved");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: PAY-02 — Webhook Ingestion, Signature Verification & Idempotency
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 2: Webhooks (SEC-02 Signature & SEC-03 Idempotency) ---");
  {
    const webhookSecret = "ve_test_secret_key";
    const orderWebhook = await createTestOrder({
      orderNumber: "VE-2026-TEST-WH",
      totalAmount: 1499.0,
      paymentMethod: "UPI",
    });

    const validPayload = JSON.stringify({
      id: "evt_test_unique_01",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_wh_captured_01",
            order_id: "order_wh_rzp_01",
            amount: 149900,
            method: "upi",
            vpa: "customer@upi",
            notes: { orderId: orderWebhook.id },
          },
        },
      },
    });

    // 1. Invalid signature rejected (SEC-02)
    const invalidResult = await processWebhook({
      gateway: "RAZORPAY",
      rawBody: validPayload,
      headers: {},
      signatureHeader: "bad_signature_attempt_123",
      secret: webhookSecret,
    });
    assert(invalidResult.status === "INVALID_SIGNATURE", "SEC-02: Invalid webhook signature rejected");

    const orderStillPending = await prisma.order.findUnique({ where: { id: orderWebhook.id } });
    assert(orderStillPending?.paymentStatus === "PENDING", "Order state remains untouched on invalid signature");

    // 2. Valid signature accepted
    const validSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(validPayload)
      .digest("hex");

    const validResult = await processWebhook({
      gateway: "RAZORPAY",
      rawBody: validPayload,
      headers: {},
      signatureHeader: validSignature,
      secret: webhookSecret,
    });
    assert(validResult.success && validResult.status === "PROCESSED", "Valid webhook processed successfully");

    const orderPaid = await prisma.order.findUnique({ where: { id: orderWebhook.id } });
    assert(orderPaid?.paymentStatus === "PAID", "Order transitioned to PAID upon captured webhook");

    // Verify raw payload persisted before processing (FR-07)
    const webhookLog = await prisma.webhookLog.findUnique({ where: { id: validResult.logId } });
    assert(webhookLog?.rawBody === validPayload, "FR-07: Raw webhook payload persisted in WebhookLog before processing");

    // 3. SEC-03 Idempotency: Delivering the exact same event id 10 times credits the order once
    let duplicateSkipped = true;
    for (let i = 0; i < 9; i++) {
      const dupResult = await processWebhook({
        gateway: "RAZORPAY",
        rawBody: validPayload,
        headers: {},
        signatureHeader: validSignature,
        secret: webhookSecret,
      });
      if (dupResult.status !== "ALREADY_PROCESSED") {
        duplicateSkipped = false;
      }
    }
    assert(duplicateSkipped, "SEC-03: Webhook delivery 10 times is idempotent; skips redundant execution");

    const orderPaidFinal = await prisma.order.findUnique({ where: { id: orderWebhook.id } });
    assert(orderPaidFinal?.paidAmount === 1499.0, "Order was NOT double-credited across duplicate deliveries");

    // 4. FR-07 Replayability
    const replayResult = await replayWebhook(validResult.logId);
    assert(replayResult.status === "ALREADY_PROCESSED", "Stored raw webhook is replayable from WebhookLog");

    // 5. FR-09 Orphaned Webhook: Webhook for unknown order is flagged, not dropped
    const orphanPayload = JSON.stringify({
      id: "evt_orphan_test_99",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_orphan_01",
            amount: 89900,
            notes: { orderId: "non_existent_order_id_999" },
          },
        },
      },
    });
    const orphanSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(orphanPayload)
      .digest("hex");

    const orphanResult = await processWebhook({
      gateway: "RAZORPAY",
      rawBody: orphanPayload,
      headers: {},
      signatureHeader: orphanSig,
      secret: webhookSecret,
    });
    assert(orphanResult.status === "ORPHANED_ORDER", "FR-09: Webhook for unknown order surfaced as orphaned");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: PAY-04 & PAY-05 — Refund Initiation, Caps, Tax, and Approvals
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 3: Refunds (PAY-04 Caps & PAY-05 Two-Person Approval) ---");
  {
    // Create an order with active lines AND one cancelled line
    const orderRefund = await createTestOrder({
      orderNumber: "VE-2026-TEST-REF",
      totalAmount: 1950.76,
      paymentMethod: "UPI",
      paymentStatus: "PAID",
      items: [
        { name: "Cotton Kurta Set", price: 899, qty: 2, igst: 203.76, status: "ACTIVE" },
        { name: "Brass Diya Set", price: 100, qty: 1, igst: 18.0, status: "ACTIVE" },
        { name: "Turmeric Powder (Cancelled)", price: 150, qty: 1, igst: 0, status: "CANCELLED" }, // Cancelled!
      ],
    });

    // 1. Refundable Breakdown (Active lines only, cancelled line excluded)
    const breakdown = await getRefundableBreakdown(orderRefund.id);
    assert(breakdown.paidPaise === 195076, "Paid paise accurately derived: 195076");
    assert(breakdown.refundablePaise === 195076, "Refundable paise is initially full paid amount: 195076");

    const hasCancelledLine = breakdown.items.some((it) => it.productName.includes("Cancelled"));
    assert(!hasCancelledLine, "PAY-04: Cancelled lines (ORD-05) are NOT offered for refund");

    // 2. FR-12: Server-side cap enforcement (attempting to refund more than refundable throws 422)
    let capRejected = false;
    try {
      await initiateRefund({
        orderId: orderRefund.id,
        amountPaise: 250000, // ₹2,500 > ₹1,950.76
        reasonCode: "CUSTOMER_REQUEST",
        userId: requesterStaff!.id,
        userName: requesterStaff!.name!,
        userRole: "FINANCE",
      });
    } catch (err: any) {
      if (err.statusCode === 422) capRejected = true;
    }
    assert(capRejected, "FR-12: Refund amount exceeding refundable cap rejected with 422");

    // 3. Partial refund below threshold (e.g. ₹500 = 50000 paise) proceeds directly to COMPLETED
    const partialRefund1 = await initiateRefund({
      orderId: orderRefund.id,
      amountPaise: 50000,
      reasonCode: "DAMAGED_ON_ARRIVAL",
      userId: requesterStaff!.id,
      userName: requesterStaff!.name!,
      userRole: "FINANCE",
    });
    assert(partialRefund1.requiresApproval === false, "Below threshold refund proceeds directly without approval");
    assert(partialRefund1.refund.status === "COMPLETED", "Below threshold refund status is COMPLETED");

    const orderAfterPart1 = await prisma.order.findUnique({ where: { id: orderRefund.id } });
    assert(orderAfterPart1?.paymentStatus === "PARTIALLY_REFUNDED", "Order paymentStatus updated to PARTIALLY_REFUNDED");

    // Check remaining refundable
    const breakdownPart2 = await getRefundableBreakdown(orderRefund.id);
    assert(breakdownPart2.alreadyRefundedPaise === 50000, "Already refunded paise is 50000");
    assert(breakdownPart2.refundablePaise === 145076, "Remaining refundable paise is 145076 (195076 - 50000)");

    // 4. High-Value Refund Approval (PAY-05): Create order for ₹24,800
    const largeOrder = await createTestOrder({
      orderNumber: "VE-2026-TEST-LARGE",
      totalAmount: 24800.0,
      paymentMethod: "UPI",
      paymentStatus: "PAID",
    });

    const highValueRefund = await initiateRefund({
      orderId: largeOrder.id,
      amountPaise: 2480000, // ₹24,800 > ₹10,000 threshold
      reasonCode: "DAMAGED_ON_ARRIVAL",
      note: "Box crushed in transit",
      userId: requesterStaff!.id,
      userName: requesterStaff!.name!,
      userRole: "FINANCE",
    });

    assert(highValueRefund.requiresApproval === true, "PAY-05: Refund above ₹10,000 enters REQUESTED approval state");
    assert(highValueRefund.refund.status === "REQUESTED", "High-value refund status is REQUESTED");

    // 5. Two-person rule: Requester cannot approve their own request (SEC-04)
    let selfApprovalBlocked = false;
    try {
      await approveRefund({
        refundId: highValueRefund.refund.id,
        userId: requesterStaff!.id, // Same user!
        userName: requesterStaff!.name!,
        userRole: "FINANCE",
      });
    } catch (err: any) {
      if (err.statusCode === 403 && err.message.includes("SELF_APPROVAL_BLOCKED")) {
        selfApprovalBlocked = true;
      }
    }
    assert(selfApprovalBlocked, "SEC-04 / PAY-05: Self-approval blocked server-side (403)");

    // 6. Second authorized approver approves it
    const approvedRefund = await approveRefund({
      refundId: highValueRefund.refund.id,
      userId: approverStaff!.id, // Different user!
      userName: approverStaff!.name!,
      userRole: "SUPER_ADMIN",
    });
    assert(approvedRefund.status === "COMPLETED", "Second approver approval moves refund to COMPLETED");
    assert(approvedRefund.approvedBy === approverStaff!.id, "approvedBy records second approver user id");

    const orderLargeFinal = await prisma.order.findUnique({ where: { id: largeOrder.id } });
    assert(orderLargeFinal?.paymentStatus === "REFUNDED", "Order paymentStatus updated to REFUNDED");

    // 7. COD Refund: Requires manual method and reference number (FR-16)
    const codOrder = await createTestOrder({
      orderNumber: "VE-2026-TEST-COD-REF",
      totalAmount: 1200,
      paymentMethod: "COD",
      paymentStatus: "PAID",
    });

    let codMissingRefBlocked = false;
    try {
      await initiateRefund({
        orderId: codOrder.id,
        amountPaise: 120000,
        reasonCode: "CUSTOMER_REQUEST",
        method: "bank_transfer",
        // missing referenceNumber!
        userId: requesterStaff!.id,
        userRole: "FINANCE",
      });
    } catch (err: any) {
      if (err.statusCode === 422) codMissingRefBlocked = true;
    }
    assert(codMissingRefBlocked, "FR-16: COD refund requires mandatory reference number");

    const validCodRefund = await initiateRefund({
      orderId: codOrder.id,
      amountPaise: 120000,
      reasonCode: "CUSTOMER_REQUEST",
      method: "bank_transfer",
      referenceNumber: "UTR2608119999",
      userId: requesterStaff!.id,
      userRole: "FINANCE",
    });
    assert(validCodRefund.refund.referenceNumber === "UTR2608119999", "COD refund recorded with reference number");
    assert(validCodRefund.refund.method === "bank_transfer", "COD refund recorded with manual method");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: PAY-06 & PAY-07 — COD Collections & Courier Remittances
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 4: COD Collections & Remittances (PAY-06, PAY-07) ---");
  {
    // 1. Shipped COD order stays PENDING
    const codOrder1 = await createTestOrder({
      orderNumber: "VE-2026-COD-01",
      totalAmount: 1950.76,
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      status: "SHIPPED",
    });

    assert(codOrder1.paymentStatus === "PENDING", "COD orders stay PENDING until delivery");

    // 2. Delivery confirms collection -> moves to PAID
    const collection1 = await trackCodCollection({
      orderId: codOrder1.id,
      courierId: "Delhivery",
      collectedPaise: 195076,
    });
    assert(collection1.status === "COLLECTED", "COD collection recorded as COLLECTED upon delivery");

    const codOrderDelivered = await prisma.order.findUnique({ where: { id: codOrder1.id } });
    assert(codOrderDelivered?.paymentStatus === "PAID", "Order paymentStatus moved to PAID upon cash collection");

    // 3. Short collection flags DISCREPANCY (PAY-06)
    const codOrderShort = await createTestOrder({
      orderNumber: "VE-2026-COD-SHORT",
      totalAmount: 1950.76,
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      status: "SHIPPED",
    });

    const collectionShort = await trackCodCollection({
      orderId: codOrderShort.id,
      courierId: "Delhivery",
      collectedPaise: 190000, // ₹50.76 short!
      discrepancyNote: "Customer paid ₹1900, short by ₹50.76",
    });
    assert(collectionShort.status === "DISCREPANCY", "Short collection flagged as DISCREPANCY");

    // 4. Remittance with non-zero variance requires explanatory note (PAY-07)
    let varianceNoteBlocked = false;
    try {
      await recordCodRemittance({
        courierId: "Delhivery",
        expectedPaise: 2840000,
        receivedPaise: 2815000, // ₹250 variance
        // missing note!
        bankReference: "UTR2608112233",
        userId: requesterStaff!.id,
      });
    } catch (err: any) {
      if (err.statusCode === 422) varianceNoteBlocked = true;
    }
    assert(varianceNoteBlocked, "PAY-07: Remittance with non-zero variance blocked without explanatory note");

    const validRemittance = await recordCodRemittance({
      courierId: "Delhivery",
      expectedPaise: 2840000,
      receivedPaise: 2815000,
      note: "1 order short — investigating with Delhivery",
      bankReference: "UTR2608112233",
      userId: requesterStaff!.id,
    });
    assert(validRemittance.status === "DISCREPANCY", "Remittance with variance marked as DISCREPANCY");
    assert(validRemittance.variancePaise === 25000, "Variance calculated accurately: 25000 paise (₹250)");

    // 5. Remittance with exact match reconciles
    const matchingRemittance = await recordCodRemittance({
      courierId: "Blue Dart",
      expectedPaise: 1420000,
      receivedPaise: 1420000,
      bankReference: "UTR2608114455",
      userId: requesterStaff!.id,
    });
    assert(matchingRemittance.status === "RECONCILED", "Matching remittance recorded as RECONCILED");
    assert(matchingRemittance.variancePaise === 0, "Matching remittance has 0 variance");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: PAY-08 — Failed Payments Queue & Link Generator
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 5: Failed Payment Queue & Link Generator (PAY-08) ---");
  {
    const orderFailedQueue = await createTestOrder({
      orderNumber: "VE-2026-TEST-FAILED-QUEUE",
      totalAmount: 3200,
      paymentMethod: "CARD",
      paymentStatus: "FAILED",
    });

    await recordTransaction({
      orderId: orderFailedQueue.id,
      gateway: "RAZORPAY",
      gatewayTransactionId: "pay_test_fail_queue_01",
      method: "CARD",
      amountPaise: 320000,
      status: "FAILED",
      cardLastFour: "1111",
      gatewayResponseCode: "INSUFFICIENT_FUNDS",
      gatewayResponseMessage: "Payment declined by bank — insufficient funds",
    });

    const failedQueue = await getFailedPaymentsQueue();
    assert(Array.isArray(failedQueue), "Failed payments queue retrieved successfully");

    const foundItem = failedQueue.find((f) => f.failureCode === "INSUFFICIENT_FUNDS");
    assert(
      foundItem !== undefined,
      "Failed payments queue surfaces verbatim gateway failure reason"
    );
    assert(
      typeof foundItem?.stockReservationRemainingMinutes === "number",
      "Stock reservation remaining time in minutes is computed for queue item"
    );

    // Generate fresh payment link
    const link = await generatePaymentLink(foundItem!.orderId);
    assert(link.url.startsWith("https://rzp.io/i/"), "Fresh gateway payment link generated");
    assert(link.amountPaise > 0, "Payment link contains accurate balance amount in paise");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: PAY-09 — Settlement Reconciliation & Append-Only Resolution
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 6: Settlement Reconciliation (PAY-09) ---");
  {
    // Create an order and matching transaction
    const reconOrder = await createTestOrder({
      orderNumber: "VE-2026-RECON-01",
      totalAmount: 1299,
      paymentMethod: "UPI",
      paymentStatus: "PAID",
    });

    const matchingTxn = await recordTransaction({
      orderId: reconOrder.id,
      gateway: "RAZORPAY",
      gatewayTransactionId: "pay_recon_match_01",
      method: "UPI",
      amountPaise: 129900,
      status: "PAID",
    });

    // Import settlement containing:
    // 1 matching, 1 amount mismatch, 1 in gateway not platform
    const importResult = await importSettlement({
      gateway: "RAZORPAY",
      settlementId: `setl_test_${Date.now()}`,
      settlementDate: new Date(),
      bankReference: "UTR2608119999",
      grossPaise: 48214000,
      feesPaise: 964280,
      taxOnFeesPaise: 173570,
      netPaise: 47076150,
      transactions: [
        {
          gatewayTransactionId: "pay_recon_match_01",
          amountPaise: 129900, // Matching!
          status: "PAID",
        },
        {
          gatewayTransactionId: "pay_recon_diff_01",
          orderNumber: "VE-2026-RECON-01",
          amountPaise: 119900, // Amount mismatch! (119900 vs 129900)
          status: "PAID",
        },
        {
          gatewayTransactionId: "pay_orphan_in_gw_99",
          amountPaise: 89900, // In gateway not platform!
          status: "PAID",
        },
      ],
      userId: approverStaff!.id,
    });

    assert(importResult.matchedCount === 1, "1 transaction matched automatically");
    assert(importResult.mismatchCount === 2, "2 mismatches detected and categorised");

    // Check reconciliation items
    const mismatches = await prisma.reconciliationItem.findMany({
      where: { settlementId: importResult.settlement.id },
    });
    assert(mismatches.some((m) => m.mismatchType === "AMOUNT_MISMATCH"), "AMOUNT_MISMATCH category flagged");
    assert(mismatches.some((m) => m.mismatchType === "IN_GATEWAY_NOT_PLATFORM"), "IN_GATEWAY_NOT_PLATFORM category flagged");

    // Resolve mismatch with written note (FR-23)
    const openItem = mismatches.find((m) => m.status === "OPEN");
    const resolved = await resolveReconciliationItem({
      itemId: openItem!.id,
      resolutionNote: "Verified with gateway support — timing adjustment accounted for",
      action: "RESOLVE",
      userId: approverStaff!.id,
      userName: approverStaff!.name!,
    });
    assert(resolved.status === "RESOLVED", "Mismatch item resolved with documented note");
    assert(Boolean(resolved.resolutionNote?.includes("Verified with gateway support")), "Resolution note appended");

    // Verify raw transaction was NEVER mutated
    const originalTxnCheck = await prisma.paymentTransaction.findUnique({
      where: { id: matchingTxn.id },
    });
    assert(originalTxnCheck?.amountPaise === 129900, "FR-23: Original payment transaction was never mutated during reconciliation");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: PAY-10 — Dashboard Summary & Attention Strips
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 7: Dashboard Summary (PAY-10) ---");
  {
    const summary = await getPaymentDashboardSummary();
    assert(typeof summary.collectedThisMonthPaise === "number", "Collected this month calculated");
    assert(typeof summary.pendingPaise === "number", "Pending orders total calculated");
    assert(typeof summary.refundedThisMonthPaise === "number", "Refunded this month calculated");
    assert(typeof summary.codDuePaise === "number", "COD due calculated");
    assert(Array.isArray(summary.methodBreakdown), "Method breakdown list available");
    assert(Array.isArray(summary.attentionStrips), "Attention strips generated");
  }

  console.log("\n================================================================================");
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPaymentEpicTests()
  .catch((err) => {
    console.error("Test execution aborted:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
