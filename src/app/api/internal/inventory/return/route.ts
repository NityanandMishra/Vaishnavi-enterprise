import { NextRequest, NextResponse } from "next/server";
import { restoreRtoStock } from "@/lib/inventory/inventory-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await restoreRtoStock(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "RTO return restoration failed" },
      { status: err.statusCode || 400 }
    );
  }
}
