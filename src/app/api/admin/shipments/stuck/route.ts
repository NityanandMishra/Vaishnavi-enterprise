import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStuckShipmentsQueue } from "@/lib/shipping/shipping-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
