import { prisma } from "@/lib/db";
import {
  OrderStatus,
  PaymentStatus,
  ORDER_TRANSITIONS,
  DEFAULT_STATUS_SLA_HOURS,
  CANCELLATION_REASONS,
  TransitionStatusInput,
  CancelOrderInput,
  CancelLineInput,
  ShippingAddressInput,
  CreateManualOrderInput,
} from "./order-types";
import { resolveShippingRate } from "./shipping-resolver";
import { getStateCodeByName } from "@/lib/tax/indian-states";
import { calculateTax, roundPaisa } from "@/lib/tax/tax-engine";
import { generateOrderInvoice } from "./invoice-generator";
import { fulfilStock, releaseStock, reserveStock } from "@/lib/inventory/inventory-service";

export class OrderTransitionError extends Error {
  statusCode: number;
  error: string;
  details?: {
    currentStatus: string;
    attempted: string;
    legalNext: string[];
  };

  constructor(
    error: string,
    message: string,
    details?: { currentStatus: string; attempted: string; legalNext: string[] },
    statusCode: number = 409
  ) {
    super(message);
    this.name = "OrderTransitionError";
    this.error = error;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Generates a human-facing, sequential order number (e.g. VE-2026-0891)
 */
export async function generateOrderNumber(tx: any = prisma): Promise<string> {
  const currentYear = new Date().getFullYear();
  const count = await tx.order.count();
  const nextSeq = count + 1;
  return `VE-${currentYear}-${String(nextSeq).padStart(4, "0")}`;
}

/**
 * Calculates new slaDueAt date based on status and default hours (ORD-10)
 */
export function calculateSlaDueAt(status: OrderStatus, fromDate: Date = new Date()): Date | null {
  const hours = DEFAULT_STATUS_SLA_HOURS[status];
  if (!hours) return null;
  return new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
}

/**
 * ORD-03: Advances an order through the status state machine.
 * Enforces legal transitions server-side.
 */
export async function transitionOrderStatus(
  orderId: string,
  input: TransitionStatusInput
) {
  const { toStatus, reason, note, actor = "System", isSystem = false } = input;

  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error(`Order #${orderId} not found`);
    }

    const currentStatus = order.status as OrderStatus;

    if (currentStatus === toStatus) {
      return { success: true, order, alreadyInState: true };
    }

    const rule = ORDER_TRANSITIONS[currentStatus];
    if (!rule) {
      throw new OrderTransitionError(
        "UNKNOWN_STATUS",
        `Order has unknown status: ${currentStatus}`,
        { currentStatus, attempted: toStatus, legalNext: [] }
      );
    }

    // Phase 4 guard: RETURNED is blocked in v1
    if (toStatus === "RETURNED") {
      throw new OrderTransitionError(
        "RETURN_FLOW_NOT_AVAILABLE",
        "Return flow is not available in v1. Return/RMA workflow will be available in Phase 4.",
        { currentStatus, attempted: toStatus, legalNext: rule.legalNext.filter((s) => s !== "RETURNED") }
      );
    }

    // Check if legal next
    if (!rule.legalNext.includes(toStatus)) {
      throw new OrderTransitionError(
        "ILLEGAL_TRANSITION",
        `Transition from ${currentStatus} to ${toStatus} is illegal.`,
        { currentStatus, attempted: toStatus, legalNext: rule.legalNext }
      );
    }

    // Check system-only transitions (SHIPPED and DELIVERED)
    if (rule.systemOnlyNext.includes(toStatus) && !isSystem) {
      if (toStatus === "SHIPPED") {
        throw new OrderTransitionError(
          "SYSTEM_ONLY_TRANSITION",
          "An order ships when its first shipment is dispatched. Create a shipment instead.",
          { currentStatus, attempted: toStatus, legalNext: rule.legalNext.filter((s) => s !== "SHIPPED") }
        );
      }
      if (toStatus === "DELIVERED") {
        throw new OrderTransitionError(
          "SYSTEM_ONLY_TRANSITION",
          "Delivery is system-driven and triggered exclusively by courier tracking events.",
          { currentStatus, attempted: toStatus, legalNext: rule.legalNext.filter((s) => s !== "DELIVERED") }
        );
      }
    }

    // Backward transition reason check
    if (rule.requiresReason?.includes(toStatus) && (!reason || reason.trim().length === 0)) {
      throw new OrderTransitionError(
        "REASON_REQUIRED",
        `A reason is required to revert order status to ${toStatus}.`,
        { currentStatus, attempted: toStatus, legalNext: rule.legalNext }
      );
    }

    // Calculate new SLA
    const newSlaDueAt = calculateSlaDueAt(toStatus);

    const now = new Date();
    const updateData: any = {
      status: toStatus,
      slaDueAt: newSlaDueAt,
      version: { increment: 1 },
    };

    if (toStatus === "CONFIRMED" && !order.confirmedAt) updateData.confirmedAt = now;
    if (toStatus === "PROCESSING" && !order.processingAt) updateData.processingAt = now;
    if (toStatus === "PACKED" && !order.packedAt) updateData.packedAt = now;
    if (toStatus === "SHIPPED" && !order.shippedAt) updateData.shippedAt = now;
    if (toStatus === "DELIVERED" && !order.deliveredAt) updateData.deliveredAt = now;
    if (toStatus === "CANCELLED") {
      updateData.cancelledAt = now;
      if (reason) updateData.cancellationReason = reason;
      if (note) updateData.cancellationNote = note;
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: updateData,
      include: { items: true },
    });

    // Append timeline entry (ORD-09)
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: currentStatus,
        toStatus,
        reason: reason || null,
        note: note || null,
        createdBy: actor,
      },
    });

    return {
      success: true,
      order: updatedOrder,
      fromStatus: currentStatus,
      toStatus,
    };
  });
}

/**
 * ORD-04 / S3: Cancels an order with a reason, releasing reserved stock
 * and flagging refunds if applicable.
 */
export async function cancelOrder(orderId: string, input: CancelOrderInput) {
  const { reason, note, actor = "System", notifyCustomer = false } = input;

  if (!reason || reason.trim().length === 0) {
    throw new Error("A cancellation reason is required.");
  }
  if (reason === "Other" && (!note || note.trim().length === 0)) {
    throw new Error("A note is required when cancellation reason is 'Other'.");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new Error(`Order #${orderId} not found`);
  }

  const currentStatus = order.status as OrderStatus;

  // Once SHIPPED, an order cannot be cancelled (A.4)
  if (currentStatus === "SHIPPED" || currentStatus === "DELIVERED") {
    throw new OrderTransitionError(
      "ILLEGAL_TRANSITION",
      "An order that has shipped cannot be cancelled.",
      { currentStatus, attempted: "CANCELLED", legalNext: ["DELIVERED", "RETURNED"] }
    );
  }

  if (currentStatus === "CANCELLED") {
    return { success: true, order, alreadyCancelled: true };
  }

  // 1. Release reserved stock (INV-05)
  await releaseStock({
    orderId,
    reason: `Order cancelled: ${reason}${note ? ` (${note})` : ""}`,
  });

  const now = new Date();
  const paidAmount = order.paidAmount || 0;
  const isPaid = paidAmount > 0;

  // Cancelling does NOT auto-refund. Flags refund-due for Payments module (Module 06)
  const refundDueAmount = isPaid ? paidAmount : 0;
  const paymentStatus = isPaid ? "REFUND_DUE" : order.paymentStatus;

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "CANCELLED",
      paymentStatus,
      refundDueAmount,
      cancelledAt: now,
      cancellationReason: reason,
      cancellationNote: note || null,
      slaDueAt: null,
      version: { increment: 1 },
    },
    include: { items: true },
  });

  // Append timeline entry
  let timelineNote = `Reason: ${reason}`;
  if (note) timelineNote += ` · Note: ${note}`;
  if (isPaid) timelineNote += ` · Refund due: ₹${paidAmount.toFixed(2)}`;
  if (notifyCustomer) timelineNote += " · Customer notified by email";

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      fromStatus: currentStatus,
      toStatus: "CANCELLED",
      reason,
      note: timelineNote,
      createdBy: actor,
    },
  });

  return {
    success: true,
    order: updatedOrder,
    releasedStock: true,
    refundDueAmount,
  };
}

/**
 * ORD-05: Cancels an individual order line, releasing only that line's stock
 * and adjusting stored order totals without mutating the original line.
 */
export async function cancelOrderLine(
  orderId: string,
  lineId: string,
  input: CancelLineInput
) {
  const { reason, actor = "System" } = input;

  if (!reason || reason.trim().length === 0) {
    throw new Error("A reason is required to cancel an order line.");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) throw new Error(`Order #${orderId} not found`);

  if (order.status === "SHIPPED" || order.status === "DELIVERED") {
    throw new OrderTransitionError(
      "ILLEGAL_TRANSITION",
      "Cannot cancel lines on an order that has already shipped.",
      { currentStatus: order.status, attempted: "CANCEL_LINE", legalNext: [] }
    );
  }

  const line = order.items.find((i) => i.id === lineId);
  if (!line) throw new Error(`Order line #${lineId} not found in order #${orderId}`);

  if (line.status === "CANCELLED") {
    return { success: true, alreadyCancelled: true, order };
  }

  const currentActiveQty = line.quantity - (line.cancelledQty || 0);
  const cancelQty = input.quantity !== undefined ? Math.min(input.quantity, currentActiveQty) : currentActiveQty;

  if (cancelQty <= 0) {
    return { success: true, alreadyCancelled: true, order };
  }

  const newCancelledQty = (line.cancelledQty || 0) + cancelQty;
  const isLineFullyCancelled = newCancelledQty >= line.quantity;

  // Calculate reduction amounts (base price + proportional tax)
  const perUnitBase = line.price;
  const totalLineTax = (line.cgstAmount || 0) + (line.sgstAmount || 0) + (line.igstAmount || 0) + (line.cessAmount || 0);
  const perUnitTax = line.quantity > 0 ? totalLineTax / line.quantity : 0;

  const baseReduction = roundPaisa(perUnitBase * cancelQty);
  const taxReduction = roundPaisa(perUnitTax * cancelQty);
  const totalReduction = roundPaisa(baseReduction + taxReduction);

  // 1. Release stock for this specific line (INV-05)
  if (line.variantId) {
    await releaseStock({
      orderId,
      items: [{ variantId: line.variantId, quantity: cancelQty }],
      reason: `Line cancelled: ${line.productName || "Item"} (${reason})`,
    });
  }

  // 2. Create OrderLineAdjustment record (FR-09)
  await prisma.orderLineAdjustment.create({
    data: {
      orderItemId: lineId,
      adjustmentType: "CANCELLATION",
      quantity: cancelQty,
      amount: baseReduction,
      taxAmount: taxReduction,
      reason,
      createdBy: actor,
    },
  });

  // 3. Update line cancelledQty & status without mutating original price/tax fields (FI-01)
  await prisma.orderItem.update({
    where: { id: lineId },
    data: {
      cancelledQty: newCancelledQty,
      status: isLineFullyCancelled ? "CANCELLED" : "ACTIVE",
    },
  });

  // 4. Update order stored totals
  const newSubtotal = Math.max(0, roundPaisa(order.subtotalAmount - baseReduction));
  const newTaxTotal = Math.max(0, roundPaisa(order.taxAmount - taxReduction));
  const newOrderTotal = Math.max(0, roundPaisa(order.totalAmount - totalReduction));

  let newRefundDue = order.refundDueAmount;
  let newBalance = order.balanceAmount;

  if (order.paidAmount > newOrderTotal) {
    newRefundDue = roundPaisa(order.paidAmount - newOrderTotal);
    newBalance = 0;
  } else {
    newBalance = roundPaisa(newOrderTotal - order.paidAmount);
  }

  // Check if all lines are now cancelled
  const remainingActiveLines = order.items.filter(
    (i) => (i.id !== lineId && i.status === "ACTIVE") || (i.id === lineId && !isLineFullyCancelled)
  );

  let nextOrderStatus = order.status;
  let cancelledAt = order.cancelledAt;
  let cancellationReason = order.cancellationReason;

  if (remainingActiveLines.length === 0) {
    nextOrderStatus = "CANCELLED";
    cancelledAt = new Date();
    cancellationReason = "All items cancelled";
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: nextOrderStatus,
      subtotalAmount: newSubtotal,
      taxAmount: newTaxTotal,
      totalAmount: newOrderTotal,
      balanceAmount: newBalance,
      refundDueAmount: newRefundDue,
      cancelledAt,
      cancellationReason,
      version: { increment: 1 },
    },
    include: { items: true },
  });

  // 5. Timeline entry
  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      toStatus: nextOrderStatus,
      reason: "Line cancelled",
      note: `Cancelled ${cancelQty}x "${line.productName || "Item"}" · Reason: ${reason} · Total adjusted −₹${totalReduction.toFixed(2)}`,
      createdBy: actor,
    },
  });

  return {
    success: true,
    order: updatedOrder,
    cancelledQty: cancelQty,
    totalReduction,
    refundDueAmount: newRefundDue,
  };
}

/**
 * ORD-07 / FI-04a: Edit delivery address pre-dispatch.
 * Reallocates tax split (CGST/SGST vs IGST) and re-resolves shipping charge.
 * Preserves taxable value and total tax amount.
 */
export async function updateOrderShippingAddress(
  orderId: string,
  newAddress: ShippingAddressInput,
  options: { actor?: string } = {}
) {
  const actor = options.actor || "System";

  // Validate pincode serviceability
  const serviceability = resolveShippingRate(newAddress.pincode, newAddress.state);
  if (!serviceability.serviceable) {
    throw new Error(serviceability.error || `We do not deliver to ${newAddress.pincode} yet`);
  }

  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new Error(`Order #${orderId} not found`);

    if (order.status === "SHIPPED" || order.status === "DELIVERED") {
      throw new OrderTransitionError(
        "ILLEGAL_TRANSITION",
        "Address cannot be changed after dispatch.",
        { currentStatus: order.status, attempted: "UPDATE_ADDRESS", legalNext: [] }
      );
    }

    const taxSettings = await tx.taxSettings.findFirst();
    const sellerStateCode = taxSettings?.sellerStateCode || "27"; // Maharashtra

    let oldAddress: any = {};
    try {
      oldAddress = typeof order.shippingAddress === "string" ? JSON.parse(order.shippingAddress) : order.shippingAddress;
    } catch {
      oldAddress = {};
    }

    const oldStateCode = order.deliveryStateCode || getStateCodeByName(oldAddress.state || "") || "27";
    const newStateCode = getStateCodeByName(newAddress.state) || "27";

    const oldPincode = (oldAddress.pincode || "").trim();
    const newPincode = newAddress.pincode.trim();

    const stateChanged = oldStateCode !== newStateCode;
    const pincodeChanged = oldPincode !== newPincode;

    const oldIsInterState = oldStateCode !== sellerStateCode;
    const newIsInterState = newStateCode !== sellerStateCode;

    let taxReallocated = false;
    let taxTimelineNote = "";

    // FI-04a: Tax reallocation between CGST+SGST and IGST
    if (stateChanged && oldIsInterState !== newIsInterState) {
      taxReallocated = true;
      if (newIsInterState) {
        // Was intra (CGST+SGST), now inter (IGST)
        for (const item of order.items) {
          const combinedTax = roundPaisa((item.cgstAmount || 0) + (item.sgstAmount || 0));
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              cgstAmount: 0,
              sgstAmount: 0,
              igstAmount: combinedTax,
            },
          });
        }
        taxTimelineNote = "Tax recalculated: CGST+SGST → IGST";
      } else {
        // Was inter (IGST), now intra (CGST+SGST split equally)
        for (const item of order.items) {
          const igst = item.igstAmount || 0;
          const halfTax = roundPaisa(igst / 2);
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              cgstAmount: halfTax,
              sgstAmount: halfTax,
              igstAmount: 0,
            },
          });
        }
        taxTimelineNote = "Tax recalculated: IGST → CGST+SGST";
      }
    }

    // Shipping re-resolution against new zone
    const oldShippingCost = order.shippingCost || 0;
    const newShippingCost = serviceability.rate;
    const shippingCostDelta = roundPaisa(newShippingCost - oldShippingCost);

    const newOrderTotal = roundPaisa(order.totalAmount + shippingCostDelta);
    let newBalance = order.balanceAmount;
    let newRefundDue = order.refundDueAmount;

    if (shippingCostDelta > 0) {
      newBalance = roundPaisa(newBalance + shippingCostDelta);
    } else if (shippingCostDelta < 0) {
      newRefundDue = roundPaisa(newRefundDue + Math.abs(shippingCostDelta));
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        shippingAddress: JSON.stringify(newAddress),
        customerName: newAddress.fullName,
        customerPhone: newAddress.phone,
        deliveryStateCode: newStateCode,
        deliveryZone: serviceability.zone,
        shippingCost: newShippingCost,
        totalAmount: newOrderTotal,
        balanceAmount: newBalance,
        refundDueAmount: newRefundDue,
        version: { increment: 1 },
      },
      include: { items: true },
    });

    // Write audit timeline entries
    const changes: string[] = [];
    if (oldAddress.addressLine1 !== newAddress.addressLine1 || oldAddress.city !== newAddress.city) {
      changes.push(`Address changed to ${newAddress.city}, ${newAddress.state} ${newAddress.pincode}`);
    }
    if (stateChanged) {
      changes.push(`State changed from ${oldAddress.state || oldStateCode} → ${newAddress.state}`);
    }
    if (taxReallocated) {
      changes.push(taxTimelineNote);
    }
    if (shippingCostDelta !== 0) {
      changes.push(
        `Shipping charge updated: ₹${oldShippingCost.toFixed(2)} → ₹${newShippingCost.toFixed(2)} (${serviceability.zone})`
      );
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        toStatus: order.status,
        reason: "Address updated",
        note: changes.join(" · ") || "Delivery address updated",
        createdBy: actor,
      },
    });

    return {
      success: true,
      order: updatedOrder,
      taxReallocated,
      shippingCostDelta,
      newShippingCost,
      newTotal: newOrderTotal,
      consequences: {
        taxSplit: newIsInterState ? "IGST" : "CGST + SGST",
        totalTaxUnchanged: true,
        oldShipping: oldShippingCost,
        newShipping: newShippingCost,
        delta: shippingCostDelta,
      },
    };
  });
}

/**
 * Module 07 / SHIP-05 / SHIP-08 Integration:
 * Dispatches a shipment for a PACKED order.
 * Consumes stock atomically (INV-04), enters SHIPPED status, generates invoice (ORD-11).
 */
export async function dispatchOrderShipment(
  orderId: string,
  shipmentData: {
    carrier?: string;
    awb?: string;
    trackingUrl?: string;
    items?: { variantId: string; quantity: number }[];
    actor?: string;
    idempotencyKey?: string;
  }
) {
  const {
    carrier = "Delhivery",
    awb = `AWB${Date.now()}`,
    trackingUrl = `https://track.courier.com/${awb}`,
    actor = "System",
    idempotencyKey,
  } = shipmentData;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) throw new Error(`Order #${orderId} not found`);

  // Active items to fulfil
  const fulfilmentLines = shipmentData.items ||
    order.items
      .filter((i) => i.variantId && i.status === "ACTIVE")
      .map((i) => ({
        variantId: i.variantId!,
        quantity: i.quantity - (i.cancelledQty || 0),
      }));

  // 1. Consume stock atomically via INV-04 (fulfilStock) with idempotency
  if (fulfilmentLines.length > 0) {
    await fulfilStock({
      orderId,
      items: fulfilmentLines,
      idempotencyKey: idempotencyKey || `dispatch-${orderId}-${awb}`,
    });
  }

  // 2. Transition status to SHIPPED (system-only transition)
  await transitionOrderStatus(orderId, {
    toStatus: "SHIPPED",
    reason: `Dispatched via ${carrier} (AWB: ${awb})`,
    actor,
    isSystem: true,
  });

  // 3. Update shipping info
  await prisma.order.update({
    where: { id: orderId },
    data: {
      trackingNumber: awb,
      trackingUrl,
    },
  });

  // 4. Generate GST tax invoice (ORD-11)
  const invoiceResult = await generateOrderInvoice(orderId, actor);

  return {
    success: true,
    orderId,
    status: "SHIPPED",
    awb,
    trackingUrl,
    invoice: invoiceResult.invoice,
  };
}

/**
 * Marks an order DELIVERED once courier confirms delivery.
 */
export async function deliverOrder(orderId: string, actor: string = "System") {
  return await transitionOrderStatus(orderId, {
    toStatus: "DELIVERED",
    reason: "Courier delivery confirmed",
    actor,
    isSystem: true,
  });
}

/**
 * Appends an internal or customer-visible note (ORD-08)
 */
export async function addOrderNote(
  orderId: string,
  input: { body: string; isCustomerVisible: boolean; actor?: string }
) {
  const { body, isCustomerVisible, actor = "Staff" } = input;

  if (!body || body.trim().length === 0) {
    throw new Error("Note body cannot be empty");
  }

  return await prisma.orderNote.create({
    data: {
      orderId,
      body: body.trim(),
      isCustomerVisible,
      createdBy: actor,
    },
  });
}

/**
 * ORD-12 / S4: Creates a manual order for phone and walk-in sales.
 * Follows identical stock reservation and tax engine rules as storefront orders.
 */
export async function createManualOrder(input: CreateManualOrderInput) {
  const {
    customer,
    items,
    shippingAddress,
    billingAddress,
    paymentMethod,
    paymentStatus,
    shippingCharge,
    orderDiscount = 0,
    customerNote,
    amountReceived = 0,
    transactionRef,
    actor = "Staff",
    source = "MANUAL",
  } = input;

  if (!items || items.length === 0) {
    throw new Error("Cannot create an order without items.");
  }

  const taxSettings = await prisma.taxSettings.findFirst({
    include: {
      defaultHsn: {
        include: {
          rateVersions: {
            orderBy: [{ effectiveFrom: "desc" }],
            include: { slabs: true },
          },
        },
      },
    },
  });

  const sellerStateCode = taxSettings?.sellerStateCode || "27";
  const deliveryStateCode = getStateCodeByName(shippingAddress.state) || "27";
  const pricingMode = (taxSettings?.pricingMode as "EXCLUSIVE" | "INCLUSIVE") || "EXCLUSIVE";

  // Check live available stock for each variant (ORD-12 FR-16)
  for (const item of items) {
    if (item.variantId) {
      const inv = await prisma.inventory.findFirst({
        where: { variantId: item.variantId },
      });
      const available = inv ? inv.onHand - inv.reserved : 0;
      if (available < item.quantity) {
        throw new Error(
          `Cannot add ${item.quantity} units — only ${available} available for variant ${item.variantId}`
        );
      }
    }
  }

  // Calculate taxes and lines
  let calculatedLines: any[] = [];
  let subtotal = 0;

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: {
        hsnRel: {
          include: {
            rateVersions: {
              orderBy: [{ effectiveFrom: "desc" }],
              include: { slabs: true },
            },
          },
        },
        category: {
          include: {
            hsnMapping: {
              include: {
                hsn: {
                  include: {
                    rateVersions: {
                      orderBy: [{ effectiveFrom: "desc" }],
                      include: { slabs: true },
                    },
                  },
                },
              },
            },
          },
        },
        variants: { where: { id: item.variantId || undefined } },
      },
    });

    if (!product) throw new Error(`Product #${item.productId} not found`);

    const variant = product.variants[0];
    const listPrice = variant?.price ?? product.basePrice;
    const unitPrice = item.unitPrice !== undefined ? item.unitPrice : listPrice;
    const lineDiscount = item.lineDiscount || 0;

    const resolvedHsn =
      product.hsnRel ||
      product.category.hsnMapping?.hsn ||
      taxSettings?.defaultHsn || {
        code: "8536",
        description: "Electrical apparatus",
        rateType: "FLAT",
        cessRate: 0,
        rateVersions: [{ id: "fallback-v1", gstRate: 18, effectiveFrom: new Date(), effectiveTo: null }],
      };

    const taxResult = calculateTax({
      unitPrice,
      quantity: item.quantity,
      discountPerUnit: item.quantity > 0 ? lineDiscount / item.quantity : 0,
      hsn: resolvedHsn as any,
      sellerStateCode,
      deliveryStateCode,
      pricingMode,
    });

    subtotal += unitPrice * item.quantity;

    calculatedLines.push({
      productId: product.id,
      variantId: variant?.id || null,
      productName: product.title,
      variantTitle: variant?.title || null,
      sku: variant?.sku || `SKU-${product.id.slice(0, 6)}`,
      quantity: item.quantity,
      price: unitPrice,
      originalPrice: listPrice !== unitPrice ? listPrice : null,
      discountAmount: lineDiscount,
      hsnCode: resolvedHsn.code,
      gstRate: taxResult.gstRate,
      cgstAmount: taxResult.cgstAmount,
      sgstAmount: taxResult.sgstAmount,
      igstAmount: taxResult.igstAmount,
      cessAmount: taxResult.cessAmount,
      taxableValue: taxResult.taxableValue,
      lineTotal: taxResult.lineTotal,
    });
  }

  const lineTaxes = calculatedLines.reduce(
    (s, l) => s + l.cgstAmount + l.sgstAmount + l.igstAmount + l.cessAmount,
    0
  );
  const totalTaxable = calculatedLines.reduce((s, l) => s + l.taxableValue, 0);

  const resolvedShipping = resolveShippingRate(shippingAddress.pincode, shippingAddress.state);
  const finalShippingCost = shippingCharge !== undefined ? shippingCharge : resolvedShipping.rate;

  const totalBeforeShipping =
    pricingMode === "INCLUSIVE"
      ? calculatedLines.reduce((s, l) => s + l.lineTotal, 0) - orderDiscount
      : totalTaxable + lineTaxes - orderDiscount;

  const grandTotal = roundPaisa(totalBeforeShipping + finalShippingCost);

  const orderId = crypto.randomUUID();

  // Atomically reserve stock (INV-03)
  const reservationLines = calculatedLines
    .filter((l) => l.variantId)
    .map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
    }));

  if (reservationLines.length > 0) {
    await reserveStock({
      orderId,
      items: reservationLines,
    });
  }

  const orderNumber = await generateOrderNumber();
  const initialStatus: OrderStatus = paymentMethod === "COD" || paymentStatus === "PAID" ? "CONFIRMED" : "PENDING";
  const initialSlaDueAt = calculateSlaDueAt(initialStatus);

  const paidAmount = paymentStatus === "PAID" ? grandTotal : amountReceived;
  const balanceAmount = Math.max(0, roundPaisa(grandTotal - paidAmount));

  const order = await prisma.order.create({
    data: {
      id: orderId,
      orderNumber,
      userId: customer.userId || null,
      source,
      status: initialStatus,
      paymentStatus,
      paymentMethod,
      subtotalAmount: roundPaisa(subtotal),
      discountAmount: roundPaisa(orderDiscount),
      shippingCost: finalShippingCost,
      taxableAmount: roundPaisa(totalTaxable),
      cgstAmount: roundPaisa(calculatedLines.reduce((s, l) => s + l.cgstAmount, 0)),
      sgstAmount: roundPaisa(calculatedLines.reduce((s, l) => s + l.sgstAmount, 0)),
      igstAmount: roundPaisa(calculatedLines.reduce((s, l) => s + l.igstAmount, 0)),
      cessAmount: roundPaisa(calculatedLines.reduce((s, l) => s + l.cessAmount, 0)),
      taxAmount: roundPaisa(lineTaxes),
      totalAmount: grandTotal,
      paidAmount,
      balanceAmount,
      shippingAddress: JSON.stringify(shippingAddress),
      billingAddress: billingAddress ? JSON.stringify(billingAddress) : JSON.stringify(shippingAddress),
      deliveryStateCode,
      deliveryZone: resolvedShipping.zone,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email || null,
      customerNote: customerNote || null,
      confirmedAt: initialStatus === "CONFIRMED" ? new Date() : null,
      slaDueAt: initialSlaDueAt,
      createdBy: actor,
      items: {
        create: calculatedLines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          productName: line.productName,
          variantTitle: line.variantTitle,
          sku: line.sku,
          quantity: line.quantity,
          price: line.price,
          originalPrice: line.originalPrice,
          discountAmount: line.discountAmount,
          taxableValue: line.taxableValue,
          hsnCode: line.hsnCode,
          gstRate: line.gstRate,
          cgstAmount: line.cgstAmount,
          sgstAmount: line.sgstAmount,
          igstAmount: line.igstAmount,
          cessAmount: line.cessAmount,
          lineTotal: line.lineTotal,
          status: "ACTIVE",
        })),
      },
    },
    include: { items: true },
  });

  // Timeline entry
  let auditNote = `Manual order placed by ${actor}`;
  if (paymentStatus === "PAID") auditNote += ` · Paid ₹${paidAmount.toFixed(2)} via ${paymentMethod}`;
  if (transactionRef) auditNote += ` (Ref: ${transactionRef})`;

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      toStatus: initialStatus,
      reason: "Manual order created",
      note: auditNote,
      createdBy: actor,
    },
  });

  return {
    success: true,
    order,
  };
}
