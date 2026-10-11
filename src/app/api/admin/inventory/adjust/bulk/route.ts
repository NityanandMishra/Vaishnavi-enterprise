import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, CATALOG_WRITE_ROLES } from "@/lib/api-guard";
import { bulkAdjustStock } from "@/lib/inventory/inventory-service";

export async function POST(request: NextRequest) {
  const auth = await guardApiRole(CATALOG_WRITE_ROLES);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const json = await request.json();
    const result = await bulkAdjustStock({
      adjustments: json.adjustments,
      mode: json.mode,
      reasonCode: json.reasonCode,
      note: json.note,
      dryRun: json.dryRun,
      actorId: (user as any).id || "admin",
      actorName: user?.name || "Admin",
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Bulk adjustment failed" },
      { status: err.statusCode || 400 }
    );
  }
}
