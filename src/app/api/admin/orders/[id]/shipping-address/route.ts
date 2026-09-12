import { NextRequest, NextResponse } from "next/server";
import { updateOrderShippingAddress, OrderTransitionError } from "@/lib/orders/order-service";

/**
 * PATCH /api/admin/orders/[id]/shipping-address
 * Implements ORD-07 / FI-04a: Edit a shipping address before dispatch.
 * Reallocates tax split (CGST/SGST vs IGST) and re-resolves shipping charge.
 * 409 if status is SHIPPED or later.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await req.json();
    const { actor = "Staff", ...addressData } = body;

    const result = await updateOrderShippingAddress(orderId, addressData, { actor });

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

    console.error("Error updating shipping address:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update shipping address" },
      { status: 400 }
    );
  }
}
