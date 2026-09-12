import { NextRequest, NextResponse } from "next/server";
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
    const orderId = params.id;
    const body = await req.json().catch(() => ({}));
    const { carrier, awb, trackingUrl, actor = "Staff" } = body;

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
