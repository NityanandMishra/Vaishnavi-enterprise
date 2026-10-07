import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const events = await prisma.shipmentEvent.findMany({
      where: { shipmentId: id },
      orderBy: { eventAt: "desc" },
    });

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error("Get shipment events error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get shipment events" },
      { status: 500 }
    );
  }
}
