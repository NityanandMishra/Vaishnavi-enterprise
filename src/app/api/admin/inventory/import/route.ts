import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { importStockCsv, bulkAdjustStock } from "@/lib/inventory/inventory-service";
import { ReasonCode } from "@/lib/inventory/types";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const role = (user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "CATALOG_MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const { rows, commit } = json;

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid rows array" }, { status: 400 });
    }

    const preview = await importStockCsv(
      rows,
      (user as any).id || "admin",
      user?.name || "Admin"
    );

    if (!commit) {
      // Just preview
      return NextResponse.json(preview);
    }

    // If commit: execute bulk adjustment in ABSOLUTE mode with CORRECTION reason
    const adjustments = preview.rows.map((r) => ({
      variantId: r.variantId,
      quantity: r.countedQty,
    }));

    const result = await bulkAdjustStock({
      adjustments,
      mode: "ABSOLUTE",
      reasonCode: ReasonCode.CORRECTION,
      note: `Stock take CSV import (${preview.rows.length} items)`,
      actorId: (user as any).id || "admin",
      actorName: user?.name || "Admin",
      dryRun: false,
    });

    return NextResponse.json({
      success: true,
      importResult: preview,
      adjustmentResult: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "CSV import failed" },
      { status: err.statusCode || 400 }
    );
  }
}
