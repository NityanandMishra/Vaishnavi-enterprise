import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, ORDER_READ_ROLES } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { resolveShippingRate } from "@/lib/shipping/shipping-service";

/**
 * GET /api/admin/shipping/serviceability?pincode
 * Returns serviceable couriers, transit days, COD support, and zone charge for a pincode (FR-12).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await guardApiRole(ORDER_READ_ROLES);
    if (auth.response) return auth.response;
    const user = auth.user;

    const { searchParams } = new URL(req.url);
    const pincode = searchParams.get("pincode")?.trim();

    if (!pincode) {
      return NextResponse.json({ error: "Pincode is required" }, { status: 422 });
    }

    const result = await resolveShippingRate({ pincode });

    return NextResponse.json({
      data: {
        pincode,
        serviceable: result.serviceable,
        zoneName: result.zoneName,
        couriers: result.courierOptions,
        error: result.error,
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/shipping/serviceability error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check serviceability" },
      { status: 500 }
    );
  }
}
