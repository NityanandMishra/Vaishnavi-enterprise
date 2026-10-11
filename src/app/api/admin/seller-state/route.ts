import { NextResponse } from "next/server";
import { guardApiRole, STAFF_ROLES } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { getStateNameByCode } from "@/lib/tax/indian-states";

/**
 * GET /api/admin/seller-state
 * Seller's registered GST state for client-side CGST/SGST vs IGST previews.
 * sellerStateCode is null until it is set in Tax Settings.
 */
export async function GET() {
  try {
    const auth = await guardApiRole(STAFF_ROLES);
    if (auth.response) return auth.response;

    const settings = await prisma.taxSettings.findFirst({ select: { sellerStateCode: true } });
    const code = settings?.sellerStateCode || null;
    return NextResponse.json({
      sellerStateCode: code,
      sellerStateName: code ? getStateNameByCode(code) : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load seller state" }, { status: 500 });
  }
}
