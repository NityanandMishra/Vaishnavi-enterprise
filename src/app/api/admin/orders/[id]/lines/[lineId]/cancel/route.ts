import { NextRequest, NextResponse } from "next/server";
import { cancelOrderLine, OrderTransitionError } from "@/lib/orders/order-service";

/**
 * POST /api/admin/orders/[id]/lines/[lineId]/cancel
 * Implements ORD-05: Cancel individual lines without mutating original lines.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; lineId: string } }
) {
  try {
    const { id: orderId, lineId } = params;
    const body = await req.json();
    const { quantity, reason, actor = "Staff" } = body;

    const result = await cancelOrderLine(orderId, lineId, {
      quantity: quantity ? parseInt(quantity, 10) : undefined,
      reason,
      actor,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof OrderTransitionError) {
      return NextResponse.json(
        {
          statusCode: error.statusCode,
          error: error.error,
          message: error.message,
          details: error.details,
        },
        { status: error.statusCode }
      );
    }

    console.error("Error cancelling order line:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel order line" },
      { status: 400 }
    );
  }
}
