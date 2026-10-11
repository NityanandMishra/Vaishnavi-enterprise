import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, ORDER_READ_ROLES } from "@/lib/api-guard";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await guardApiRole(ORDER_READ_ROLES);
    if (auth.response) return auth.response;
    const user = auth.user;

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
