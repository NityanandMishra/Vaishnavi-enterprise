import { NextRequest, NextResponse } from "next/server";
import { releaseStock, releaseExpiredReservations } from "@/lib/inventory/inventory-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === "releaseExpired") {
      const result = await releaseExpiredReservations(body.windowMinutes || 60);
      return NextResponse.json(result);
    }
    const result = await releaseStock(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Release failed" },
      { status: err.statusCode || 400 }
    );
  }
}
