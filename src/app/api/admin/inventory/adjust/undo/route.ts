import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, CATALOG_WRITE_ROLES } from "@/lib/api-guard";
import { undoBulkAdjust } from "@/lib/inventory/inventory-service";

export async function POST(request: NextRequest) {
  const auth = await guardApiRole(CATALOG_WRITE_ROLES);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { batchId } = await request.json();
    if (!batchId) {
      return NextResponse.json({ error: "Batch ID is required" }, { status: 400 });
    }

    const result = await undoBulkAdjust(
      batchId,
      (user as any).id || "admin",
      user?.name || "Admin"
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Undo failed" },
      { status: err.statusCode || 400 }
    );
  }
}
