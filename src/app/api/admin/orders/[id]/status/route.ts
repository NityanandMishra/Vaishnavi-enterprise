import { NextRequest, NextResponse } from "next/server";
import { transitionOrderStatus, OrderTransitionError } from "@/lib/orders/order-service";

/**
 * PATCH /api/admin/orders/[id]/status
 * Implements ORD-03: Advance an order through the pipeline.
 * Rejects illegal moves with 409 ILLEGAL_TRANSITION.
 * Rejects manual SHIPPED with 409 SYSTEM_ONLY_TRANSITION.
 * Rejects RETURNED with 409 RETURN_FLOW_NOT_AVAILABLE.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await req.json();
    const { toStatus, reason, note, actor = "Staff" } = body;

    if (!toStatus) {
      return NextResponse.json(
        { error: "toStatus is required" },
        { status: 400 }
      );
    }

    const result = await transitionOrderStatus(orderId, {
      toStatus,
      reason,
      note,
      actor,
      isSystem: false, // Calls from admin status endpoint are not system dispatches
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

    console.error("Error transitioning order status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update order status" },
      { status: 500 }
    );
  }
}
