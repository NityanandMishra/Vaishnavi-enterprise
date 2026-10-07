import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { resolveShippingRate } from "@/lib/shipping/shipping-service";

/**
 * GET /api/admin/shipping/serviceability?pincode
 * Returns serviceable couriers, transit days, COD support, and zone charge for a pincode (FR-12).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

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
