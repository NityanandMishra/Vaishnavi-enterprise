import { NextRequest, NextResponse } from "next/server";
import { guardInternalApi } from "@/lib/api-guard";
import { fulfilStock } from "@/lib/inventory/inventory-service";

export async function POST(request: NextRequest) {
  const denied = guardInternalApi(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const result = await fulfilStock(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Fulfilment consumption failed" },
      { status: err.statusCode || 400 }
    );
  }
}
