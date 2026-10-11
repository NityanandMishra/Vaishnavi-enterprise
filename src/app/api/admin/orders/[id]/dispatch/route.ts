import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, ORDER_WRITE_ROLES } from "@/lib/api-guard";
import { dispatchOrderShipment } from "@/lib/orders/order-service";

/**
 * POST /api/admin/orders/[id]/dispatch
 * Dispatches a shipment for a PACKED order.
 * Consumes stock (INV-04), transitions to SHIPPED, and generates invoice (ORD-11).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await guardApiRole(ORDER_WRITE_ROLES);
    if (auth.response) return auth.response;
    const orderId = params.id;
    const body = await req.json().catch(() => ({}));
    const { carrier, awb, trackingUrl } = body;
    const actor = auth.user.name; // audit actor comes from the session, never the request body

    const result = await dispatchOrderShipment(orderId, {
      carrier,
      awb,
      trackingUrl,
      actor,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error dispatching shipment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to dispatch shipment" },
      { status: 400 }
    );
  }
}
