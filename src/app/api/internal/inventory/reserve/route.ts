import { NextRequest, NextResponse } from "next/server";
import { reserveStock } from "@/lib/inventory/inventory-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await reserveStock(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Reservation failed" },
      { status: err.statusCode || 400 }
    );
  }
}
