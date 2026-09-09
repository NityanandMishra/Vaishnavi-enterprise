import { NextRequest, NextResponse } from "next/server";
import { fulfilStock } from "@/lib/inventory/inventory-service";

export async function POST(request: NextRequest) {
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
