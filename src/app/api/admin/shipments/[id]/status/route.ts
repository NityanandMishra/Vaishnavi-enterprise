import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ingestTrackingEvent } from "@/lib/shipping/shipping-service";
import { prisma } from "@/lib/db";

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
    const { status, reason, location } = body;

    if (!status || !reason) {
      return NextResponse.json(
        { error: "Status and reason are required for manual status update" },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: { courier: true },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const result = await ingestTrackingEvent({
      shipmentId: id,
      status,
      description: `${reason} (Set manually by ${user.name || user.email})`,
      location: location || "Manual Entry",
      source: "MANUAL",
      createdBy: user.id,
      createdByName: user.name || user.email,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Manual status update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update shipment status" },
      { status: 500 }
    );
  }
}
