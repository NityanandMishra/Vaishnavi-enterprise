import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { configureZoneRate } from "@/lib/shipping/shipping-service";
import { parsePaise } from "@/lib/money";

/**
 * GET /api/admin/shipping/zones/:id/rates
 * POST /api/admin/shipping/zones/:id/rates
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = params;
    const rates = await prisma.shippingRate.findMany({
      where: { zoneId: id },
      include: { slabs: { orderBy: { minWeightGrams: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: rates });
  } catch (error: any) {
    console.error("GET /api/admin/shipping/zones/:id/rates error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch zone rates" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const {
      rateType,
      flatAmount,
      flatAmountPaise: rawFlat,
      freeAbove,
      freeAbovePaise: rawFree,
      codSurcharge,
      codSurchargePaise: rawCod,
      codSurchargePercent,
      slabs,
    } = body;

    const flatAmountPaise = rawFlat !== undefined ? Math.round(rawFlat) : flatAmount ? parsePaise(flatAmount) : null;
    const freeAbovePaise = rawFree !== undefined ? Math.round(rawFree) : freeAbove ? parsePaise(freeAbove) : null;
    const codSurchargePaise = rawCod !== undefined ? Math.round(rawCod) : codSurcharge ? parsePaise(codSurcharge) : null;

    const formattedSlabs = slabs?.map((s: any) => ({
      minWeightGrams: s.minWeightGrams !== undefined ? parseInt(s.minWeightGrams, 10) : undefined,
      maxWeightGrams: s.maxWeightGrams !== null && s.maxWeightGrams !== undefined ? parseInt(s.maxWeightGrams, 10) : null,
      minValuePaise: s.minValuePaise !== undefined ? Math.round(s.minValuePaise) : s.minValue ? parsePaise(s.minValue) : undefined,
      maxValuePaise: s.maxValuePaise !== null && s.maxValuePaise !== undefined ? Math.round(s.maxValuePaise) : s.maxValue ? parsePaise(s.maxValue) : null,
      amountPaise: s.amountPaise !== undefined ? Math.round(s.amountPaise) : parsePaise(s.amount),
      perAdditionalWeightGrams: s.perAdditionalWeightGrams ? parseInt(s.perAdditionalWeightGrams, 10) : null,
      perAdditionalAmountPaise: s.perAdditionalAmountPaise ? Math.round(s.perAdditionalAmountPaise) : s.perAdditionalAmount ? parsePaise(s.perAdditionalAmount) : null,
    }));

    const rate = await configureZoneRate({
      zoneId: id,
      rateType: rateType || "FLAT",
      flatAmountPaise,
      freeAbovePaise,
      codSurchargePaise,
      codSurchargePercent: codSurchargePercent !== undefined ? parseFloat(codSurchargePercent) : null,
      slabs: formattedSlabs,
    });

    return NextResponse.json({ data: rate }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/shipping/zones/:id/rates error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to configure zone rate" },
      { status: error.statusCode || 500 }
    );
  }
}
