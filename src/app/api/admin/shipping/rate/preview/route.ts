import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { resolveShippingRate } from "@/lib/shipping/shipping-service";
import { parsePaise } from "@/lib/money";

/**
 * POST /api/admin/shipping/rate/preview
 * Implements SHIP-11: Rate calculator with prose explanation and courier serviceability.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json();
    const { pincode, weightGrams, orderValue, orderValuePaise: rawVal, isCod, stateCode } = body;

    if (!pincode) {
      return NextResponse.json({ error: "Pincode is required" }, { status: 422 });
    }

    const orderValuePaise = rawVal !== undefined ? Math.round(rawVal) : orderValue ? parsePaise(orderValue) : 0;

    const result = await resolveShippingRate({
      pincode: String(pincode).trim(),
      weightGrams: weightGrams ? parseInt(weightGrams, 10) : 500,
      orderValuePaise,
      isCod: Boolean(isCod),
      stateCode: stateCode ? String(stateCode).trim() : undefined,
    });

    return NextResponse.json({
      data: {
        serviceable: result.serviceable,
        zone: result.zoneName,
        ruleApplied: result.ruleApplied,
        baseCharge: (result.baseChargePaise / 100).toFixed(2),
        baseChargePaise: result.baseChargePaise,
        codSurcharge: (result.codSurchargePaise / 100).toFixed(2),
        codSurchargePaise: result.codSurchargePaise,
        freeShippingApplied: result.freeShippingApplied,
        total: (result.totalShippingChargePaise / 100).toFixed(2),
        totalPaise: result.totalShippingChargePaise,
        explanation: result.explanation,
        courierOptions: result.courierOptions,
        error: result.error,
      },
    });
  } catch (error: any) {
    console.error("POST /api/admin/shipping/rate/preview error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to preview shipping rate" },
      { status: 500 }
    );
  }
}
