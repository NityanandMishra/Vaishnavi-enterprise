import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transitionOrderStatus, OrderTransitionError } from "@/lib/orders/order-service";

/**
 * POST /api/admin/orders/bulk/status
 * Implements ORD-14: Bulk status transitions.
 * Advances valid orders and skips illegal orders with descriptive reporting.
 * Explicitly rejects bulk cancel.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderIds, toStatus, reason, note, actor = "Staff" } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: "orderIds array is required" },
        { status: 400 }
      );
    }

    if (!toStatus) {
      return NextResponse.json(
        { error: "toStatus is required" },
        { status: 400 }
      );
    }

    // ORD-14 Scenario: Bulk cancel is NOT offered
    if (toStatus === "CANCELLED") {
      return NextResponse.json(
        {
          error:
            "Bulk cancellation is not permitted. Cancellation requires an individual reason and refund review per order.",
        },
        { status: 400 }
      );
    }

    const transitioned: string[] = [];
    const skipped: { id: string; orderNumber: string; reason: string }[] = [];

    for (const id of orderIds) {
      const order = await prisma.order.findUnique({
        where: { id },
        select: { id: true, orderNumber: true, status: true },
      });

      if (!order) {
        skipped.push({ id, orderNumber: id, reason: "Order not found" });
        continue;
      }

      try {
        await transitionOrderStatus(id, {
          toStatus,
          reason,
          note,
          actor,
          isSystem: false,
        });
        transitioned.push(order.orderNumber || order.id);
      } catch (err: any) {
        skipped.push({
          id: order.id,
          orderNumber: order.orderNumber || order.id,
          reason: err.message || "Illegal transition",
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalRequested: orderIds.length,
      successCount: transitioned.length,
      skippedCount: skipped.length,
      transitioned,
      skipped,
    });
  } catch (error: any) {
    console.error("Error performing bulk status transition:", error);
    return NextResponse.json(
      { error: error.message || "Bulk transition failed" },
      { status: 500 }
    );
  }
}
