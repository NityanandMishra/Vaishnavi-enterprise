import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, ORDER_READ_ROLES } from "@/lib/api-guard";
import { getStuckShipmentsQueue } from "@/lib/shipping/shipping-service";

export async function GET(req: NextRequest) {
  try {
    const auth = await guardApiRole(ORDER_READ_ROLES);
    if (auth.response) return auth.response;
    const user = auth.user;

    const queue = await getStuckShipmentsQueue();
    return NextResponse.json(queue);
  } catch (error: any) {
    console.error("Get stuck shipments queue error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get stuck shipments" },
      { status: 500 }
    );
  }
}
