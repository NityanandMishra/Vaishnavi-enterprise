import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, ADMIN_ONLY } from "@/lib/api-guard";
import { addZoneRule, bulkAddPincodesToZone } from "@/lib/shipping/shipping-service";

/**
 * POST /api/admin/shipping/zones/:id/rules
 * Add coverage rule to zone with specificity & overlap checking.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await guardApiRole(ADMIN_ONLY);
    if (auth.response) return auth.response;
    const user = auth.user;

    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { matchType, pincode, pincodeFrom, pincodeTo, stateCode, region, pincodesBulk } = body;

    // Handle bulk pincodes if passed
    if (pincodesBulk) {
      const result = await bulkAddPincodesToZone(id, pincodesBulk);
      return NextResponse.json({
        message: `Successfully added ${result.addedCount} pincodes to zone`,
        data: result,
      }, { status: 201 });
    }

    const rule = await addZoneRule({
      zoneId: id,
      matchType,
      pincode,
      pincodeFrom,
      pincodeTo,
      stateCode,
      region,
    });

    return NextResponse.json({ data: rule }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/shipping/zones/:id/rules error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add zone rule" },
      { status: error.statusCode || 500 }
    );
  }
}
