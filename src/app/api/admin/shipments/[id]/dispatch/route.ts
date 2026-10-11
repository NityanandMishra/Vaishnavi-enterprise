import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, ORDER_WRITE_ROLES } from "@/lib/api-guard";
import { dispatchShipment } from "@/lib/shipping/shipping-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await guardApiRole(ORDER_WRITE_ROLES);
    if (auth.response) return auth.response;
    const user = auth.user;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { awbNumber } = body;

    const shipment = await dispatchShipment({
      shipmentId: id,
      awbNumber,
      userId: user.id,
      userName: user.name || user.email,
    });

    return NextResponse.json({ success: true, shipment });
  } catch (error: any) {
    console.error("Dispatch shipment error:", error);
    const status = error.statusCode || 400;
    return NextResponse.json(
      { error: error.message || "Failed to dispatch shipment" },
      { status }
    );
  }
}
