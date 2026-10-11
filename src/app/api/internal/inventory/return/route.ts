import { NextRequest, NextResponse } from "next/server";
import { guardInternalApi } from "@/lib/api-guard";
import { restoreRtoStock } from "@/lib/inventory/inventory-service";

export async function POST(request: NextRequest) {
  const denied = guardInternalApi(request);
  if (denied) return denied;

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
