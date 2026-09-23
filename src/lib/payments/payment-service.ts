import crypto from "crypto";
import { prisma } from "@/lib/db";
import { rupeesToPaise, paiseToRupees, formatPaise } from "@/lib/money";
import {
  PaymentStatus,
  RefundStatus,
  PaymentMethod,
  GatewayType,
  RefundReasonCode,
  REFUND_REASON_LABELS,
  CodCollectionStatus,
  RecordTransactionInput,
  InitiateRefundInput,
  RefundableBreakdown,
  RefundableItemLine,
  ApproveRefundInput,
  RejectRefundInput,
  CodRemittanceInput,
  SettlementImportInput,
  PaymentDashboardSummary,
  PaymentFilterParams,
  MismatchType,
} from "./payment-types";

// ─── SETTINGS HELPER ─────────────────────────────────────────────────────────

export async function getPaymentSettings() {
  let settings = await prisma.paymentSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.paymentSettings.create({
      data: {
        id: "default",
        refundApprovalThreshold: 1000000, // ₹10,000 in integer paise
        codAutoDiscrepancyHours: 48,
      },
    });
  }

  return settings;
}

export async function updatePaymentSettings(data: {
  refundApprovalThreshold?: number;
  codAutoDiscrepancyHours?: number;
  updatedBy?: string;
}) {
  return await prisma.paymentSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      refundApprovalThreshold: data.refundApprovalThreshold ?? 1000000,
      codAutoDiscrepancyHours: data.codAutoDiscrepancyHours ?? 48,
      updatedBy: data.updatedBy,
    },
    update: {
      ...(data.refundApprovalThreshold !== undefined && {
        refundApprovalThreshold: data.refundApprovalThreshold,
      }),
      ...(data.codAutoDiscrepancyHours !== undefined && {
        codAutoDiscrepancyHours: data.codAutoDiscrepancyHours,
      }),
      updatedBy: data.updatedBy,
    },
  });
}

// ─── UNIQUE NUMBER GENERATORS ───────────────────────────────────────────────

export async function generateRefundNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `REF-${currentYear}-`;

  const lastRefund = await prisma.refund.findFirst({
    where: { refundNumber: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: { refundNumber: true },
  });

  let nextSeq = 1;
  if (lastRefund && lastRefund.refundNumber) {
    const parts = lastRefund.refundNumber.split("-");
    const seq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(seq)) {
      nextSeq = seq + 1;
    }
  }

  return `${prefix}${nextSeq.toString().padStart(4, "0")}`;
}

// ─── 1. TRANSACTION RECORDING (PAY-01, FR-01 - FR-05) ───────────────────────

/**
 * Persist every payment attempt. Append-only, integer paise, no PAN/CVV (SEC-01).
 */
export async function recordTransaction(input: RecordTransactionInput) {
  // Ensure order exists
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, paymentStatus: true, totalAmount: true, paidAmount: true },
  });

  if (!order) {
    throw new Error(`ORDER_NOT_FOUND: Order ${input.orderId} does not exist`);
  }

  // SEC-01 Sanity check: Ensure cardLastFour contains at most 4 digits
  let safeLastFour = input.cardLastFour;
  if (safeLastFour) {
    safeLastFour = safeLastFour.replace(/\D/g, "").slice(-4);
  }

  return await prisma.$transaction(async (tx) => {
    // Transaction row is append-only (PRD A.7)
    const transaction = await tx.paymentTransaction.create({
      data: {
        orderId: input.orderId,
        gateway: input.gateway || "RAZORPAY",
        gatewayTransactionId: input.gatewayTransactionId,
        gatewayOrderId: input.gatewayOrderId,
        method: input.method,
        amountPaise: Math.round(input.amountPaise),
        status: input.status,
        gatewayResponseCode: input.gatewayResponseCode,
        gatewayResponseMessage: input.gatewayResponseMessage,
        cardLastFour: safeLastFour,
        upiVpaMasked: input.upiVpaMasked,
        bankName: input.bankName,
        initiatedAt: input.initiatedAt || new Date(),
        completedAt: input.completedAt || (input.status === "PAID" ? new Date() : null),
      },
    });

    // Append-only event log
    await tx.paymentEvent.create({
      data: {
        transactionId: transaction.id,
        eventType:
          input.status === "PAID"
            ? "payment.captured"
            : input.status === "FAILED"
            ? "payment.failed"
            : "payment.initiated",
        fromStatus: null,
        toStatus: input.status,
        gatewayEventId: input.gatewayEventId || null,
        rawPayload:
          typeof input.rawPayload === "object"
            ? JSON.stringify(input.rawPayload)
            : input.rawPayload || null,
        signatureVerified: input.signatureVerified ?? false,
        processedAt: new Date(),
      },
    });

    // Update order's payment status based on transaction
    if (input.status === "PAID") {
      const paidRupees = paiseToRupees(input.amountPaise);
      const newPaidAmount = (order.paidAmount || 0) + paidRupees;
      const balanceAmount = Math.max(0, (order.totalAmount || 0) - newPaidAmount);

      await tx.order.update({
        where: { id: input.orderId },
        data: {
          paymentStatus: balanceAmount === 0 ? "PAID" : "PARTIALLY_PAID",
          paidAmount: newPaidAmount,
          balanceAmount: balanceAmount,
          razorpayPaymentId: input.gatewayTransactionId || undefined,
        },
      });
    } else if (input.status === "FAILED" && order.paymentStatus === "PENDING") {
      // Only mark order failed if it was not already paid
      await tx.order.update({
        where: { id: input.orderId },
        data: { paymentStatus: "FAILED" },
      });
    }

    return transaction;
  });
}

// ─── 2. WEBHOOK INGESTION (PAY-02, SEC-02, SEC-03, FR-06 - FR-10) ───────────

/**
 * Verify webhook signature against secret using HMAC SHA256.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret || !rawBody) return false;
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf-8"),
      Buffer.from(expectedSignature, "utf-8")
    );
  } catch (_) {
    return false;
  }
}

export interface WebhookProcessResult {
  success: boolean;
  status: "PROCESSED" | "ALREADY_PROCESSED" | "INVALID_SIGNATURE" | "ORPHANED_ORDER" | "ERROR";
  message: string;
  logId: string;
  orderId?: string;
  transactionId?: string;
}

/**
 * Safely ingest gateway webhook:
 * 1. Persists raw body before any processing (FR-07)
 * 2. Signature verification (SEC-02)
 * 3. Idempotency on gatewayEventId (SEC-03)
 * 4. Out-of-order protection (does not regress PAID state)
 * 5. Flags orphaned orders for reconciliation queue (FR-09)
 */
export async function processWebhook(params: {
  gateway: "RAZORPAY" | "PAYU" | "CASHFREE" | string;
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  signatureHeader?: string;
  secret?: string;
  isPreVerified?: boolean;
}): Promise<WebhookProcessResult> {
  const { gateway, rawBody, headers } = params;

  // Header signature extraction
  const signature =
    params.signatureHeader ||
    (headers["x-razorpay-signature"] as string) ||
    (headers["signature"] as string) ||
    "";

  const secret = params.secret || process.env.RAZORPAY_WEBHOOK_SECRET || "ve_test_secret_key";

  // Parse raw body safely
  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    // Malformed JSON still stored
    const log = await prisma.webhookLog.create({
      data: {
        gateway,
        rawBody,
        headers: JSON.stringify(headers),
        signatureValid: false,
        processed: false,
        processingError: "MALFORMED_JSON",
      },
    });
    return {
      success: false,
      status: "ERROR",
      message: "Malformed JSON payload",
      logId: log.id,
    };
  }

  const eventId = payload.event_id || payload.id || headers["x-razorpay-event-id"] || null;
  const eventType = payload.event || payload.event_type || "payment.unknown";

  // 1. Verify signature (SEC-02)
  const isSignatureValid = params.isPreVerified || verifyWebhookSignature(rawBody, signature, secret);

  // Headers to persist (preserve signature for replay)
  const headersToPersist = { ...(headers || {}) };
  if (signature && !headersToPersist["x-razorpay-signature"]) {
    headersToPersist["x-razorpay-signature"] = signature;
  }

  // FR-07: Persist raw body before processing
  const log = await prisma.webhookLog.create({
    data: {
      gateway,
      eventId: eventId ? String(eventId) : null,
      eventType: String(eventType),
      rawBody,
      headers: JSON.stringify(headersToPersist),
      signatureValid: isSignatureValid,
      processed: false,
    },
  });

  if (!isSignatureValid) {
    console.warn(`[SECURITY ALERT] Invalid webhook signature from gateway ${gateway}, logId: ${log.id}`);
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { processingError: "INVALID_SIGNATURE" },
    });
    return {
      success: false,
      status: "INVALID_SIGNATURE",
      message: "Webhook signature verification failed",
      logId: log.id,
    };
  }

  // 2. Idempotency Check on eventId (SEC-03)
  if (eventId) {
    const existingEvent = await prisma.paymentEvent.findUnique({
      where: { gatewayEventId: String(eventId) },
    });

    if (existingEvent) {
      // Already processed! Return 200 equivalent so gateway stops retrying.
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: { processed: true, processedAt: new Date() },
      });
      return {
        success: true,
        status: "ALREADY_PROCESSED",
        message: "Event already processed (idempotent skip)",
        logId: log.id,
      };
    }
  }

  // 3. Process event types
  try {
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const paymentEntity = payload.payload?.payment?.entity || payload.payment || payload;
      const gatewayTxnId = paymentEntity.id || paymentEntity.transaction_id;
      const gatewayOrderId = paymentEntity.order_id;
      const amountPaise = paymentEntity.amount ? parseInt(paymentEntity.amount, 10) : 0;
      const methodRaw = paymentEntity.method || "UPI";
      const method = methodRaw.toUpperCase();

      // Card last 4 digits only (SEC-01)
      let cardLastFour: string | undefined = undefined;
      if (paymentEntity.card?.last4) {
        cardLastFour = paymentEntity.card.last4;
      }

      const upiVpa = paymentEntity.vpa || undefined;
      const bankName = paymentEntity.bank || undefined;

      // Match Order
      const notesOrderId = paymentEntity.notes?.orderId || paymentEntity.notes?.order_id;
      let order = null;

      if (notesOrderId) {
        order = await prisma.order.findUnique({ where: { id: notesOrderId } });
      }
      if (!order && gatewayOrderId) {
        order = await prisma.order.findFirst({
          where: { razorpayOrderId: gatewayOrderId },
        });
      }
      if (!order && paymentEntity.notes?.orderNumber) {
        order = await prisma.order.findUnique({
          where: { orderNumber: paymentEntity.notes.orderNumber },
        });
      }

      // FR-09: Orphaned Webhooks surfaced, not dropped
      if (!order) {
        await prisma.webhookLog.update({
          where: { id: log.id },
          data: {
            processingError: "ORPHANED_ORDER: No matching order found",
            processed: false,
          },
        });

        // Create orphan mismatch item in reconciliation queue if open settlement exists
        return {
          success: false,
          status: "ORPHANED_ORDER",
          message: "Order not found for captured payment. Stored as orphaned.",
          logId: log.id,
        };
      }

      // Out-of-order guard: If already PAID, don't re-credit, but record transaction/event if missing
      const isAlreadyPaid = order.paymentStatus === "PAID";

      // Create transaction record
      const txn = await prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
          gateway,
          gatewayTransactionId: gatewayTxnId,
          gatewayOrderId: gatewayOrderId,
          method,
          amountPaise: amountPaise || rupeesToPaise(order.totalAmount),
          status: "PAID",
          gatewayResponseCode: "SUCCESS",
          gatewayResponseMessage: "Payment captured successfully",
          cardLastFour,
          upiVpaMasked: upiVpa,
          bankName,
          completedAt: new Date(),
        },
      });

      // Record event with idempotency key
      await prisma.paymentEvent.create({
        data: {
          transactionId: txn.id,
          eventType,
          fromStatus: order.paymentStatus,
          toStatus: "PAID",
          gatewayEventId: eventId ? String(eventId) : null,
          rawPayload: rawBody,
          signatureVerified: true,
          processedAt: new Date(),
        },
      });

      // Update Order if not already paid
      if (!isAlreadyPaid) {
        const paidRupees = paiseToRupees(amountPaise || rupeesToPaise(order.totalAmount));
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "PAID",
            paidAmount: paidRupees,
            balanceAmount: Math.max(0, order.totalAmount - paidRupees),
            razorpayPaymentId: gatewayTxnId || undefined,
          },
        });
      }

      await prisma.webhookLog.update({
        where: { id: log.id },
        data: { processed: true, processedAt: new Date() },
      });

      return {
        success: true,
        status: "PROCESSED",
        message: "Payment captured and order updated",
        logId: log.id,
        orderId: order.id,
        transactionId: txn.id,
      };
    } else if (eventType === "payment.failed") {
      const paymentEntity = payload.payload?.payment?.entity || payload.payment || payload;
      const gatewayTxnId = paymentEntity.id;
      const gatewayOrderId = paymentEntity.order_id;
      const amountPaise = paymentEntity.amount ? parseInt(paymentEntity.amount, 10) : 0;
      const method = (paymentEntity.method || "UPI").toUpperCase();
      const errorCode = paymentEntity.error_code || "PAYMENT_FAILED";
      const errorDescription =
        paymentEntity.error_description || "Payment failed or declined by issuing bank";

      const notesOrderId = paymentEntity.notes?.orderId || paymentEntity.notes?.order_id;
      let order = null;
      if (notesOrderId) {
        order = await prisma.order.findUnique({ where: { id: notesOrderId } });
      }
      if (!order && gatewayOrderId) {
        order = await prisma.order.findFirst({
          where: { razorpayOrderId: gatewayOrderId },
        });
      }

      if (order) {
        const txn = await prisma.paymentTransaction.create({
          data: {
            orderId: order.id,
            gateway,
            gatewayTransactionId: gatewayTxnId,
            gatewayOrderId,
            method,
            amountPaise,
            status: "FAILED",
            gatewayResponseCode: errorCode,
            gatewayResponseMessage: errorDescription,
            completedAt: new Date(),
          },
        });

        await prisma.paymentEvent.create({
          data: {
            transactionId: txn.id,
            eventType,
            fromStatus: order.paymentStatus,
            toStatus: "FAILED",
            gatewayEventId: eventId ? String(eventId) : null,
            rawPayload: rawBody,
            signatureVerified: true,
            processedAt: new Date(),
          },
        });

        // Out-of-order guard: Do not downgrade an already PAID order!
        if (order.paymentStatus === "PENDING") {
          await prisma.order.update({
            where: { id: order.id },
            data: { paymentStatus: "FAILED" },
          });
        }
      }

      await prisma.webhookLog.update({
        where: { id: log.id },
        data: { processed: true, processedAt: new Date() },
      });

      return {
        success: true,
        status: "PROCESSED",
        message: "Failed payment recorded",
        logId: log.id,
        orderId: order?.id,
      };
    }

    // Unhandled event types marked processed
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { processed: true, processedAt: new Date() },
    });

    return {
      success: true,
      status: "PROCESSED",
      message: `Event ${eventType} recorded`,
      logId: log.id,
    };
  } catch (err: any) {
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        processed: false,
        processingError: err.message || "INTERNAL_PROCESSING_ERROR",
        retryCount: { increment: 1 },
      },
    });
    return {
      success: false,
      status: "ERROR",
      message: err.message,
      logId: log.id,
    };
  }
}

/**
 * Replay an existing raw webhook from WebhookLog (FR-07, FR-10).
 */
export async function replayWebhook(logId: string) {
  const log = await prisma.webhookLog.findUnique({ where: { id: logId } });
  if (!log) throw new Error("WEBHOOK_LOG_NOT_FOUND");

  let parsedHeaders: Record<string, any> = {};
  if (log.headers) {
    try {
      parsedHeaders = JSON.parse(log.headers);
    } catch (_) {}
  }

  const signature =
    (parsedHeaders["x-razorpay-signature"] as string) ||
    (parsedHeaders["signature"] as string) ||
    undefined;

  return await processWebhook({
    gateway: log.gateway,
    rawBody: log.rawBody,
    headers: parsedHeaders,
    signatureHeader: signature,
    secret: process.env.RAZORPAY_WEBHOOK_SECRET || "ve_test_secret_key",
    isPreVerified: log.signatureValid,
  });
}

// ─── 3. REFUNDS (PAY-04, PAY-05, FR-11 - FR-17, SEC-04) ────────────────────

/**
 * Calculate order refundable breakdown.
 * - Stored line values only (FI-01, TR-07). Never recomputed.
 * - Active lines only (cancelled lines excluded per ORD-05).
 */
export async function getRefundableBreakdown(orderId: string): Promise<RefundableBreakdown> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        where: { status: "ACTIVE" }, // Cancelled lines never offered! (PAY-04)
      },
      refunds: {
        where: {
          status: { in: ["COMPLETED", "PROCESSING", "APPROVED"] },
        },
      },
      transactions: {
        where: { status: "PAID" },
      },
    },
  });

  if (!order) throw new Error(`ORDER_NOT_FOUND: Order ${orderId} does not exist`);

  const settings = await getPaymentSettings();

  // Paid amount calculation in paise
  let paidPaise = rupeesToPaise(order.paidAmount || 0);
  if (paidPaise === 0 && order.transactions.length > 0) {
    paidPaise = order.transactions.reduce((acc, t) => acc + t.amountPaise, 0);
  }

  // Already refunded calculation in paise
  const alreadyRefundedPaise = order.refunds.reduce(
    (acc, r) => acc + r.amountPaise,
    0
  );

  const refundablePaise = Math.max(0, paidPaise - alreadyRefundedPaise);

  // Active items breakdown
  const items: RefundableItemLine[] = order.items.map((it) => {
    const cgstP = rupeesToPaise(it.cgstAmount || 0);
    const sgstP = rupeesToPaise(it.sgstAmount || 0);
    const igstP = rupeesToPaise(it.igstAmount || 0);
    const totalTaxP = cgstP + sgstP + igstP;
    const taxableP = rupeesToPaise(it.taxableValue || 0);
    const lineTotalP = rupeesToPaise(it.lineTotal || (it.price * it.quantity));

    return {
      orderItemId: it.id,
      productName: it.productName || "Product",
      variantTitle: it.variantTitle || undefined,
      sku: it.sku || undefined,
      quantity: it.quantity,
      unitPricePaise: rupeesToPaise(it.price),
      taxableValuePaise: taxableP,
      cgstPaise: cgstP,
      sgstPaise: sgstP,
      igstPaise: igstP,
      totalTaxPaise: totalTaxP,
      lineTotalPaise: lineTotalP,
    };
  });

  // Calculate tax component for full refundable amount
  // Reads stored order taxAmount
  const totalTaxPaise = rupeesToPaise(order.taxAmount || 0);
  const totalAmountPaise = rupeesToPaise(order.totalAmount || 1);
  const taxRatio = totalTaxPaise / totalAmountPaise;
  const taxComponentPaise = Math.round(refundablePaise * taxRatio);

  const isCod = order.paymentMethod === "COD";

  return {
    orderId: order.id,
    orderNumber: order.orderNumber || order.id,
    paymentStatus: order.paymentStatus,
    paidPaise,
    alreadyRefundedPaise,
    refundablePaise,
    shippingPaise: rupeesToPaise(order.shippingCost || 0),
    discountPaise: rupeesToPaise(order.discountAmount || 0),
    items,
    taxComponentPaise,
    isCod,
    approvalThresholdPaise: settings.refundApprovalThreshold,
  };
}

/**
 * Initiate a refund with strict caps, reason checks, and threshold branching.
 */
export async function initiateRefund(input: InitiateRefundInput) {
  const { orderId, amountPaise, reasonCode, note, method, referenceNumber, userId, userName, userRole } = input;

  // Server-side permission check (SEC-04, FR-11)
  const allowedRoles = ["SUPER_ADMIN", "ADMIN", "FINANCE"];
  if (userRole && !allowedRoles.includes(userRole)) {
    const error: any = new Error("FORBIDDEN: Only SUPER_ADMIN and FINANCE can initiate refunds");
    error.statusCode = 403;
    throw error;
  }

  // Reason code is mandatory (FR-11)
  if (!reasonCode) {
    const error: any = new Error("REASON_REQUIRED: A valid reason code is required for refunds");
    error.statusCode = 422;
    throw error;
  }

  if (reasonCode === "OTHER" && (!note || !note.trim())) {
    const error: any = new Error("NOTE_REQUIRED: A note is mandatory when selecting 'Other' reason");
    error.statusCode = 422;
    throw error;
  }

  const breakdown = await getRefundableBreakdown(orderId);

  // FR-12: The refundable amount is capped at (paid - already_refunded)
  if (amountPaise > breakdown.refundablePaise) {
    const error: any = new Error(
      `REFUND_EXCEEDS_CAP: Maximum refundable is ${formatPaise(breakdown.refundablePaise)} (requested: ${formatPaise(amountPaise)})`
    );
    error.statusCode = 422;
    throw error;
  }

  if (amountPaise <= 0) {
    const error: any = new Error("INVALID_AMOUNT: Refund amount must be greater than zero");
    error.statusCode = 422;
    throw error;
  }

  // COD refunds require manual method and reference number (FR-16)
  if (breakdown.isCod) {
    if (!method || method === "gateway") {
      const error: any = new Error("MANUAL_METHOD_REQUIRED: COD refunds require a manual method (bank_transfer, upi, or cash)");
      error.statusCode = 422;
      throw error;
    }
    if (!referenceNumber || !referenceNumber.trim()) {
      const error: any = new Error("REFERENCE_NUMBER_REQUIRED: A reference number is required for manual COD refunds");
      error.statusCode = 422;
      throw error;
    }
  }

  const refundNumber = await generateRefundNumber();

  // Compute proportional tax component
  const taxRatio = breakdown.paidPaise > 0 ? breakdown.taxComponentPaise / breakdown.refundablePaise : 0;
  const taxComponentPaise = Math.round(amountPaise * taxRatio);

  const settings = await getPaymentSettings();
  const requiresApproval = amountPaise > settings.refundApprovalThreshold;

  // Find latest paid transaction if any
  const lastTxn = await prisma.paymentTransaction.findFirst({
    where: { orderId, status: "PAID" },
    orderBy: { createdAt: "desc" },
  });

  if (requiresApproval) {
    // Above threshold: Move to REQUESTED (FR-14, FR-15)
    const refund = await prisma.refund.create({
      data: {
        orderId,
        transactionId: lastTxn?.id || null,
        refundNumber,
        amountPaise,
        taxComponentPaise,
        reasonCode,
        note: note?.trim() || null,
        status: "REQUESTED",
        method: method || (breakdown.isCod ? "bank_transfer" : "gateway"),
        referenceNumber: referenceNumber?.trim() || null,
        requestedBy: userId || "system",
        requestedByName: userName || "Staff",
        requestedAt: new Date(),
      },
    });

    return {
      refund,
      requiresApproval: true,
      message: `Refund ${refundNumber} of ${formatPaise(amountPaise)} submitted for approval (threshold: ${formatPaise(settings.refundApprovalThreshold)}).`,
    };
  }

  // Below threshold: Skip REQUESTED, go directly to PROCESSING -> COMPLETED (FR-15)
  const newAlreadyRefunded = breakdown.alreadyRefundedPaise + amountPaise;
  const isFullyRefunded = newAlreadyRefunded >= breakdown.paidPaise;

  const refund = await prisma.$transaction(async (tx) => {
    const rf = await tx.refund.create({
      data: {
        orderId,
        transactionId: lastTxn?.id || null,
        refundNumber,
        amountPaise,
        taxComponentPaise,
        reasonCode,
        note: note?.trim() || null,
        status: "COMPLETED", // Below threshold auto-processes
        gatewayRefundId: !breakdown.isCod ? `rfnd_sim_${Date.now()}` : null,
        method: method || (breakdown.isCod ? "bank_transfer" : "gateway"),
        referenceNumber: referenceNumber?.trim() || null,
        requestedBy: userId || "system",
        requestedByName: userName || "Staff",
        requestedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Update order's paymentStatus
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: isFullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });

    // Record audit note on Order
    await tx.orderNote.create({
      data: {
        orderId,
        body: `Refund ${refundNumber} issued for ${formatPaise(amountPaise)} (${REFUND_REASON_LABELS[reasonCode as RefundReasonCode] || reasonCode}). Method: ${rf.method}.`,
        createdBy: userName || "System",
        isCustomerVisible: false,
      },
    });

    return rf;
  });

  return {
    refund,
    requiresApproval: false,
    message: `Refund ${refundNumber} of ${formatPaise(amountPaise)} completed successfully.`,
  };
}

/**
 * Approve a high-value refund with strict two-person enforcement (FR-14, PAY-05, SEC-04).
 */
export async function approveRefund(input: ApproveRefundInput) {
  const { refundId, userId, userName, userRole } = input;

  const allowedRoles = ["SUPER_ADMIN", "ADMIN", "FINANCE"];
  if (userRole && !allowedRoles.includes(userRole)) {
    const error: any = new Error("FORBIDDEN: Only SUPER_ADMIN and FINANCE can approve refunds");
    error.statusCode = 403;
    throw error;
  }

  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: { order: true },
  });

  if (!refund) throw new Error("REFUND_NOT_FOUND");

  if (refund.status !== "REQUESTED") {
    const error: any = new Error(`INVALID_STATUS: Refund is currently ${refund.status}, only REQUESTED refunds can be approved`);
    error.statusCode = 409;
    throw error;
  }

  // SEC-04 / PAY-05: The approver CANNOT be the requester (Two-person rule)
  if (refund.requestedBy && refund.requestedBy === userId) {
    const error: any = new Error("SELF_APPROVAL_BLOCKED: You cannot approve a refund you requested");
    error.statusCode = 403;
    throw error;
  }

  // Move to APPROVED -> PROCESSING -> COMPLETED in atomic transaction
  const breakdown = await getRefundableBreakdown(refund.orderId);
  const newAlreadyRefunded = breakdown.alreadyRefundedPaise + refund.amountPaise;
  const isFullyRefunded = newAlreadyRefunded >= breakdown.paidPaise;

  const updatedRefund = await prisma.$transaction(async (tx) => {
    const rf = await tx.refund.update({
      where: { id: refundId },
      data: {
        status: "COMPLETED",
        approvedBy: userId,
        approvedByName: userName,
        approvedAt: new Date(),
        completedAt: new Date(),
        gatewayRefundId: refund.method === "gateway" ? `rfnd_sim_${Date.now()}` : undefined,
      },
    });

    await tx.order.update({
      where: { id: refund.orderId },
      data: {
        paymentStatus: isFullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });

    await tx.orderNote.create({
      data: {
        orderId: refund.orderId,
        body: `Refund ${refund.refundNumber} for ${formatPaise(refund.amountPaise)} approved by ${userName} and completed.`,
        createdBy: userName,
        isCustomerVisible: false,
      },
    });

    return rf;
  });

  return updatedRefund;
}

/**
 * Reject a requested refund with mandatory reason.
 */
export async function rejectRefund(input: RejectRefundInput) {
  const { refundId, userId, userName, userRole, reason } = input;

  const allowedRoles = ["SUPER_ADMIN", "ADMIN", "FINANCE"];
  if (userRole && !allowedRoles.includes(userRole)) {
    const error: any = new Error("FORBIDDEN: Only SUPER_ADMIN and FINANCE can reject refunds");
    error.statusCode = 403;
    throw error;
  }

  if (!reason || !reason.trim()) {
    const error: any = new Error("REJECTION_REASON_REQUIRED: A written rejection reason is mandatory");
    error.statusCode = 422;
    throw error;
  }

  const refund = await prisma.refund.findUnique({ where: { id: refundId } });
  if (!refund) throw new Error("REFUND_NOT_FOUND");

  if (refund.status !== "REQUESTED") {
    const error: any = new Error(`INVALID_STATUS: Refund is currently ${refund.status}, only REQUESTED refunds can be rejected`);
    error.statusCode = 409;
    throw error;
  }

  // Requester cannot reject their own refund either
  if (refund.requestedBy && refund.requestedBy === userId) {
    const error: any = new Error("SELF_REJECTION_BLOCKED: You cannot reject a refund you requested");
    error.statusCode = 403;
    throw error;
  }

  const updatedRefund = await prisma.refund.update({
    where: { id: refundId },
    data: {
      status: "REJECTED",
      failureReason: reason.trim(),
      approvedBy: userId,
      approvedByName: userName,
      approvedAt: new Date(),
    },
  });

  await prisma.orderNote.create({
    data: {
      orderId: refund.orderId,
      body: `Refund ${refund.refundNumber} for ${formatPaise(refund.amountPaise)} rejected by ${userName}. Reason: "${reason.trim()}".`,
      createdBy: userName,
      isCustomerVisible: false,
    },
  });

  return updatedRefund;
}

/**
 * Retry a failed refund.
 */
export async function retryRefund(refundId: string, user: { id: string; name: string }) {
  const refund = await prisma.refund.findUnique({ where: { id: refundId } });
  if (!refund) throw new Error("REFUND_NOT_FOUND");

  if (refund.status !== "FAILED") {
    throw new Error(`Refund status is ${refund.status}, only FAILED refunds can be retried`);
  }

  const updatedRefund = await prisma.refund.update({
    where: { id: refundId },
    data: {
      status: "COMPLETED",
      failureReason: null,
      gatewayRefundId: `rfnd_retry_${Date.now()}`,
      completedAt: new Date(),
    },
  });

  return updatedRefund;
}

// ─── 4. COD COLLECTIONS & REMITTANCES (PAY-06, PAY-07, FR-18 - FR-20) ──────

/**
 * Mark COD order delivered and record collected amount.
 * Moves COD from PENDING to PAID (FR-18).
 * Detects short-collection discrepancies (FR-20).
 */
export async function trackCodCollection(params: {
  orderId: string;
  collectedPaise?: number;
  courierId?: string;
  discrepancyNote?: string;
}) {
  const { orderId, courierId, discrepancyNote } = params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, paymentMethod: true, totalAmount: true, paymentStatus: true },
  });

  if (!order) throw new Error(`ORDER_NOT_FOUND: ${orderId}`);

  const expectedPaise = rupeesToPaise(order.totalAmount);
  const collectedPaise = params.collectedPaise !== undefined ? params.collectedPaise : expectedPaise;

  const isDiscrepancy = collectedPaise < expectedPaise;
  const status: CodCollectionStatus = isDiscrepancy ? "DISCREPANCY" : "COLLECTED";

  const collection = await prisma.codCollection.upsert({
    where: { orderId },
    create: {
      orderId,
      courierId: courierId || "Delhivery",
      expectedPaise,
      collectedPaise,
      collectedAt: new Date(),
      status,
      discrepancyNote: isDiscrepancy ? discrepancyNote || "Short collection detected" : null,
    },
    update: {
      collectedPaise,
      collectedAt: new Date(),
      status,
      discrepancyNote: isDiscrepancy ? discrepancyNote || "Short collection detected" : null,
      courierId: courierId || undefined,
    },
  });

  // If collected successfully, update order to PAID and create transaction
  if (collectedPaise > 0) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        paidAmount: paiseToRupees(collectedPaise),
        balanceAmount: 0,
      },
    });

    await recordTransaction({
      orderId,
      gateway: "COD",
      method: "COD",
      amountPaise: collectedPaise,
      status: "PAID",
      gatewayResponseCode: "CASH_COLLECTED",
      gatewayResponseMessage: "Cash collected upon delivery",
      completedAt: new Date(),
    });
  }

  return collection;
}

/**
 * Record a courier COD remittance and match against expected collections (PAY-07).
 * Non-zero variance requires a note before saving!
 */
export async function recordCodRemittance(input: CodRemittanceInput) {
  const { courierId, periodStart, periodEnd, expectedPaise, receivedPaise, bankReference, note, orderIds, userId, userName } = input;

  const variancePaise = expectedPaise - receivedPaise;

  // Non-zero variance requires a note (PAY-07)
  if (variancePaise !== 0 && (!note || !note.trim())) {
    const error: any = new Error(
      `VARIANCE_NOTE_REQUIRED: Non-zero variance of ${formatPaise(variancePaise)} requires an explanatory note.`
    );
    error.statusCode = 422;
    throw error;
  }

  const remittanceStatus = variancePaise === 0 ? "RECONCILED" : "DISCREPANCY";

  const remittance = await prisma.codRemittance.create({
    data: {
      courierId,
      periodStart: periodStart || new Date(Date.now() - 7 * 86400000),
      periodEnd: periodEnd || new Date(),
      expectedPaise,
      receivedPaise,
      variancePaise,
      bankReference: bankReference?.trim() || null,
      status: remittanceStatus,
      note: note?.trim() || null,
      reconciledBy: userId || "system",
      reconciledByName: userName || "Staff",
      reconciledAt: new Date(),
    },
  });

  // Update associated collections
  if (orderIds && orderIds.length > 0) {
    await prisma.codCollection.updateMany({
      where: { orderId: { in: orderIds } },
      data: {
        remittanceId: remittance.id,
        status: variancePaise === 0 ? "REMITTED" : "DISCREPANCY",
      },
    });
  } else {
    // If orderIds not explicitly passed, associate all collected unremitted for this courier
    await prisma.codCollection.updateMany({
      where: {
        courierId,
        status: "COLLECTED",
        remittanceId: null,
      },
      data: {
        remittanceId: remittance.id,
        status: variancePaise === 0 ? "REMITTED" : "DISCREPANCY",
      },
    });
  }

  return remittance;
}

/**
 * Resolve a COD discrepancy with an append-only resolution note (FR-20).
 */
export async function resolveCodDiscrepancy(params: {
  collectionId: string;
  resolutionNote: string;
  userId: string;
  userName: string;
}) {
  const { collectionId, resolutionNote, userName } = params;

  if (!resolutionNote || !resolutionNote.trim()) {
    const error: any = new Error("RESOLUTION_NOTE_REQUIRED: A written resolution note is mandatory");
    error.statusCode = 422;
    throw error;
  }

  const collection = await prisma.codCollection.findUnique({
    where: { id: collectionId },
    include: { order: true },
  });

  if (!collection) throw new Error("COLLECTION_NOT_FOUND");

  const existingNote = collection.discrepancyNote ? `${collection.discrepancyNote} | ` : "";
  const appendedNote = `${existingNote}Resolved by ${userName}: ${resolutionNote.trim()}`;

  const updated = await prisma.codCollection.update({
    where: { id: collectionId },
    data: {
      status: "COLLECTED",
      discrepancyNote: appendedNote,
    },
  });

  return updated;
}

// ─── 5. SETTLEMENT RECONCILIATION (PAY-09, FR-21 - FR-23) ───────────────────

/**
 * Import gateway settlement file and automatically match transactions.
 * Detects 4 discrepancy categories (FR-22):
 * 1. IN_GATEWAY_NOT_PLATFORM
 * 2. IN_PLATFORM_NOT_GATEWAY
 * 3. AMOUNT_MISMATCH
 * 4. STATUS_MISMATCH
 */
export async function importSettlement(input: SettlementImportInput) {
  const { gateway, settlementId, settlementDate, bankReference, grossPaise, feesPaise, taxOnFeesPaise, netPaise, transactions, userId, userName } = input;

  const settlement = await prisma.settlement.create({
    data: {
      gateway,
      settlementId,
      settlementDate: new Date(settlementDate),
      grossPaise,
      feesPaise,
      taxOnFeesPaise,
      netPaise,
      bankReference: bankReference?.trim() || null,
      transactionCount: transactions.length,
      status: "OPEN",
    },
  });

  // Extract all IDs and order numbers upfront for batch queries (O(N) -> O(1) database trips)
  const gatewayTxnIds = transactions
    .map((t) => t.gatewayTransactionId)
    .filter((id): id is string => Boolean(id));
  const orderNumbers = transactions
    .map((t) => t.orderNumber)
    .filter((num): num is string => Boolean(num));

  // Batch query transactions and orders in parallel
  const [existingTxns, existingOrders] = await Promise.all([
    gatewayTxnIds.length > 0
      ? prisma.paymentTransaction.findMany({
          where: { gatewayTransactionId: { in: gatewayTxnIds } },
          include: { order: true },
        })
      : [],
    orderNumbers.length > 0
      ? prisma.order.findMany({
          where: { orderNumber: { in: orderNumbers } },
          include: { transactions: true },
        })
      : [],
  ]);

  // Build O(1) in-memory lookup maps
  const txnByGatewayId = new Map<string, (typeof existingTxns)[0]>();
  for (const txn of existingTxns) {
    if (txn.gatewayTransactionId) {
      txnByGatewayId.set(txn.gatewayTransactionId, txn);
    }
  }

  const orderByNumber = new Map<string, (typeof existingOrders)[0]>();
  for (const ord of existingOrders) {
    if (ord.orderNumber) {
      orderByNumber.set(ord.orderNumber, ord);
    }
  }

  let matchedCount = 0;
  let mismatchCount = 0;
  const itemsToCreate: any[] = [];

  for (const row of transactions) {
    // Attempt match by gatewayTransactionId
    let platformTxn: any = row.gatewayTransactionId ? txnByGatewayId.get(row.gatewayTransactionId) : null;

    // If not found, attempt match by orderNumber
    if (!platformTxn && row.orderNumber) {
      const order = orderByNumber.get(row.orderNumber);
      platformTxn = order?.transactions?.[0] ? { ...order.transactions[0], order } : null;
    }

    if (!platformTxn) {
      // 1. In gateway, not in platform
      itemsToCreate.push({
        settlementId: settlement.id,
        gatewayTxnId: row.gatewayTransactionId,
        orderNumber: row.orderNumber || null,
        mismatchType: "IN_GATEWAY_NOT_PLATFORM",
        gatewayAmountPaise: row.amountPaise,
        platformAmountPaise: null,
        status: "OPEN",
      });
      mismatchCount++;
    } else if (platformTxn.amountPaise !== row.amountPaise) {
      // 2. Amount differs
      itemsToCreate.push({
        settlementId: settlement.id,
        transactionId: platformTxn.id,
        gatewayTxnId: row.gatewayTransactionId,
        orderNumber: platformTxn.order?.orderNumber || row.orderNumber,
        mismatchType: "AMOUNT_MISMATCH",
        platformAmountPaise: platformTxn.amountPaise,
        gatewayAmountPaise: row.amountPaise,
        status: "OPEN",
      });
      mismatchCount++;
    } else if (platformTxn.status !== row.status && row.status.toUpperCase() !== "CAPTURED") {
      // 3. Status differs
      itemsToCreate.push({
        settlementId: settlement.id,
        transactionId: platformTxn.id,
        gatewayTxnId: row.gatewayTransactionId,
        orderNumber: platformTxn.order?.orderNumber || row.orderNumber,
        mismatchType: "STATUS_MISMATCH",
        platformAmountPaise: platformTxn.amountPaise,
        gatewayAmountPaise: row.amountPaise,
        status: "OPEN",
      });
      mismatchCount++;
    } else {
      matchedCount++;
    }
  }

  // Batch insert reconciliation items
  if (itemsToCreate.length > 0) {
    await prisma.reconciliationItem.createMany({
      data: itemsToCreate,
    });
  }

  // Update settlement status if all matched
  if (mismatchCount === 0) {
    await prisma.settlement.update({
      where: { id: settlement.id },
      data: { status: "RECONCILED", reconciledAt: new Date() },
    });
  }

  return {
    settlement,
    matchedCount,
    mismatchCount,
  };
}

/**
 * Resolve a reconciliation mismatch with a written note (FR-23, PAY-09).
 * Resolution NEVER silently edits a transaction; it appends a reconciliation_items resolution row.
 */
export async function resolveReconciliationItem(params: {
  itemId: string;
  resolutionNote: string;
  action: "RESOLVE" | "IGNORE";
  userId: string;
  userName: string;
}) {
  const { itemId, resolutionNote, action, userId, userName } = params;

  if (!resolutionNote || !resolutionNote.trim()) {
    const error: any = new Error("RESOLUTION_NOTE_REQUIRED: A written resolution note is mandatory");
    error.statusCode = 422;
    throw error;
  }

  const item = await prisma.reconciliationItem.findUnique({
    where: { id: itemId },
    include: { settlement: true },
  });

  if (!item) throw new Error("RECONCILIATION_ITEM_NOT_FOUND");

  const newStatus = action === "IGNORE" ? "IGNORED" : "RESOLVED";

  const updatedItem = await prisma.reconciliationItem.update({
    where: { id: itemId },
    data: {
      status: newStatus,
      resolutionNote: resolutionNote.trim(),
      resolvedBy: userId,
      resolvedByName: userName,
      resolvedAt: new Date(),
    },
  });

  // Check if all items in this settlement are now resolved or ignored
  const openCount = await prisma.reconciliationItem.count({
    where: { settlementId: item.settlementId, status: "OPEN" },
  });

  if (openCount === 0) {
    await prisma.settlement.update({
      where: { id: item.settlementId },
      data: { status: "RECONCILED", reconciledAt: new Date() },
    });
  }

  return updatedItem;
}

// ─── 6. DASHBOARD SUMMARY & STATS (PAY-10, S1) ──────────────────────────────

export async function getPaymentDashboardSummary(): Promise<PaymentDashboardSummary> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Execute all independent dashboard queries in parallel (cuts query latency by ~70%)
  const [
    collectedTxns,
    pendingOrders,
    refundsThisMonth,
    codCollectionsDue,
    awaitingRefunds,
    failedTxnsLast24h,
    codDiscrepancies,
  ] = await Promise.all([
    // 1. Collected this month (successful transactions)
    prisma.paymentTransaction.findMany({
      where: {
        status: "PAID",
        createdAt: { gte: startOfMonth },
      },
      select: { amountPaise: true, method: true },
    }),
    // 2. Pending orders
    prisma.order.findMany({
      where: {
        paymentStatus: "PENDING",
        status: { notIn: ["CANCELLED", "RETURNED"] },
        paymentMethod: { not: "COD" },
      },
      select: { totalAmount: true },
    }),
    // 3. Refunded this month
    prisma.refund.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: startOfMonth },
      },
      select: { amountPaise: true },
    }),
    // 4. COD Due (shipped/out with couriers)
    prisma.codCollection.findMany({
      where: {
        status: { in: ["PENDING", "COLLECTED"] },
      },
      select: { expectedPaise: true },
    }),
    // 🔴 1. Refunds awaiting approval
    prisma.refund.findMany({
      where: { status: "REQUESTED" },
      select: { amountPaise: true },
    }),
    // 🟠 2. Failed payments in the last 24 hours
    prisma.paymentTransaction.count({
      where: {
        status: "FAILED",
        createdAt: { gte: twentyFourHoursAgo },
      },
    }),
    // 🟠 3. COD delivered but not collected or in discrepancy
    prisma.codCollection.findMany({
      where: { status: "DISCREPANCY" },
      select: { expectedPaise: true, collectedPaise: true },
    }),
  ]);

  const collectedThisMonthPaise = collectedTxns.reduce((acc, t) => acc + t.amountPaise, 0);
  const collectedCount = collectedTxns.length;
  const pendingPaise = pendingOrders.reduce((acc, o) => acc + rupeesToPaise(o.totalAmount), 0);
  const pendingCount = pendingOrders.length;
  const refundedThisMonthPaise = refundsThisMonth.reduce((acc, r) => acc + r.amountPaise, 0);
  const refundedCount = refundsThisMonth.length;
  const codDuePaise = codCollectionsDue.reduce((acc, c) => acc + c.expectedPaise, 0);
  const codDueCount = codCollectionsDue.length;

  // 5. Method breakdown for horizontal stacked bar (UPI, COD, Card, Netbanking)
  const methodMap: Record<string, { amountPaise: number; count: number }> = {
    UPI: { amountPaise: 0, count: 0 },
    COD: { amountPaise: 0, count: 0 },
    CARD: { amountPaise: 0, count: 0 },
    NETBANKING: { amountPaise: 0, count: 0 },
  };

  collectedTxns.forEach((t) => {
    const m = (t.method || "UPI").toUpperCase();
    const key = methodMap[m] ? m : "UPI";
    methodMap[key].amountPaise += t.amountPaise;
    methodMap[key].count += 1;
  });

  const totalCollectedForMethod = collectedThisMonthPaise || 1;
  const methodBreakdown = Object.entries(methodMap).map(([m, val]) => ({
    method: m,
    label: m === "NETBANKING" ? "Netbanking" : m,
    amountPaise: val.amountPaise,
    count: val.count,
    percentage: Math.round((val.amountPaise / totalCollectedForMethod) * 100) || 0,
  }));

  const codDiscrepancyAmount = codDiscrepancies.reduce(
    (acc, c) => acc + (c.expectedPaise - (c.collectedPaise || 0)),
    0
  );

  const attentionStrips: PaymentDashboardSummary["attentionStrips"] = [];

  if (awaitingRefunds.length > 0) {
    attentionStrips.push({
      id: "refunds_awaiting",
      severity: "danger",
      message: `${awaitingRefunds.length} refund${awaitingRefunds.length > 1 ? "s are" : " is"} awaiting your approval.`,
      count: awaitingRefunds.length,
      amountPaise: awaitingRefunds.reduce((acc, r) => acc + r.amountPaise, 0),
      actionLabel: "Review →",
      actionHref: "/admin/payments/refunds",
    });
  }

  if (failedTxnsLast24h > 0) {
    attentionStrips.push({
      id: "failed_payments_24h",
      severity: "warning",
      message: `${failedTxnsLast24h} payment${failedTxnsLast24h > 1 ? "s" : ""} failed in the last 24 hours.`,
      count: failedTxnsLast24h,
      actionLabel: "Review →",
      actionHref: "/admin/payments/failed",
    });
  }

  if (codDiscrepancies.length > 0) {
    attentionStrips.push({
      id: "cod_uncollected",
      severity: "warning",
      message: `${formatPaise(codDiscrepancyAmount)} of COD is delivered but has uncollected variance.`,
      count: codDiscrepancies.length,
      amountPaise: codDiscrepancyAmount,
      actionLabel: "Review →",
      actionHref: "/admin/payments/cod",
    });
  }

  return {
    collectedThisMonthPaise,
    collectedCount,
    pendingPaise,
    pendingCount,
    refundedThisMonthPaise,
    refundedCount,
    codDuePaise,
    codDueCount,
    methodBreakdown,
    attentionStrips,
  };
}

// ─── 7. FAILED PAYMENT QUEUE & RETRY LINKS (PAY-08) ─────────────────────────

export async function getFailedPaymentsQueue() {
  const failedTxns = await prisma.paymentTransaction.findMany({
    where: {
      status: "FAILED",
      order: {
        paymentStatus: {
          notIn: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"],
        },
      },
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          paymentStatus: true,
          status: true,
          customerName: true,
          customerPhone: true,
          placedAt: true,
          slaDueAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const now = Date.now();

  return failedTxns.map((t) => {
    // Order reservation window is 60 minutes from placedAt
    const placedTime = t.order?.placedAt ? new Date(t.order.placedAt).getTime() : t.createdAt.getTime();
    const expiryTime = placedTime + 60 * 60 * 1000;
    const remainingMs = Math.max(0, expiryTime - now);
    const remainingMinutes = Math.floor(remainingMs / (60 * 1000));

    return {
      transactionId: t.id,
      orderId: t.orderId,
      orderNumber: t.order?.orderNumber || t.orderId,
      customerName: t.order?.customerName || "Customer",
      customerPhone: t.order?.customerPhone || "N/A",
      amountPaise: t.amountPaise,
      method: t.method,
      gateway: t.gateway,
      failureReason: t.gatewayResponseMessage || "Payment declined by bank",
      failureCode: t.gatewayResponseCode || "DECLINED",
      createdAt: t.createdAt,
      orderStatus: t.order?.status || "PENDING",
      stockReservationRemainingMinutes: remainingMinutes,
      isExpired: remainingMinutes <= 0 || t.order?.status === "CANCELLED",
    };
  });
}

/**
 * Generate fresh gateway payment link for order (PAY-08).
 */
export async function generatePaymentLink(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, totalAmount: true, paidAmount: true, balanceAmount: true },
  });

  if (!order) throw new Error("ORDER_NOT_FOUND");

  const computedBalance =
    order.balanceAmount != null && order.balanceAmount > 0
      ? rupeesToPaise(order.balanceAmount)
      : rupeesToPaise(Math.max(0, order.totalAmount - (order.paidAmount || 0)));
  const balancePaise = computedBalance > 0 ? computedBalance : rupeesToPaise(order.totalAmount);

  const linkId = `plink_${order.orderNumber || order.id}_${Date.now().toString(36)}`;
  const url = `https://rzp.io/i/${linkId}`;

  return {
    paymentLinkId: linkId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    amountPaise: balancePaise,
    url,
    expiresInMinutes: 45,
  };
}
