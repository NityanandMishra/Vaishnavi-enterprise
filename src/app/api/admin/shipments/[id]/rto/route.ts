import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { markShipmentRto, recordRtoReceived } from "@/lib/shipping/shipping-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, reason, returnShippingCostPaise } = body;

    if (action === "MARK_RTO") {
      if (!reason) {
        return NextResponse.json(
          { error: "Reason is required to mark shipment as RTO" },
          { status: 400 }
        );
      }
      const updated = await markShipmentRto(id, reason, user.id, user.name || user.email);
      return NextResponse.json({ success: true, shipment: updated });
    }

    if (action === "RECORD_RECEIVED") {
      const updated = await recordRtoReceived({
        shipmentId: id,
        returnShippingCostPaise: returnShippingCostPaise ? parseInt(returnShippingCostPaise, 10) : undefined,
        userId: user.id,
        userName: user.name || user.email,
      });
      return NextResponse.json({ success: true, shipment: updated });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported actions: MARK_RTO, RECORD_RECEIVED" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Shipment RTO action error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process RTO action" },
      { status: 500 }
    );
  }
}
