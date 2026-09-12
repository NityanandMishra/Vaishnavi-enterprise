import { NextRequest, NextResponse } from "next/server";
import { cancelOrder, OrderTransitionError } from "@/lib/orders/order-service";

/**
 * POST /api/admin/orders/[id]/cancel
 * Implements ORD-04 / S3: Cancel an order and release its stock.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await req.json();
    const { reason, note, actor = "Staff", notifyCustomer = false } = body;

    const result = await cancelOrder(orderId, {
      reason,
      note,
      actor,
      notifyCustomer,
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

    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel order" },
      { status: 400 }
    );
  }
}
