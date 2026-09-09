import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { bulkAdjustStock } from "@/lib/inventory/inventory-service";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const role = (user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "CATALOG_MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
