import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { parsePaise } from "@/lib/money";

/**
 * PATCH /api/admin/shipping/rates/:id
 */
export async function PATCH(
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
    const { flatAmount, freeAbove, codSurcharge, codSurchargePercent, isActive } = body;

    const updated = await prisma.shippingRate.update({
      where: { id },
      data: {
        ...(flatAmount !== undefined && { flatAmountPaise: flatAmount ? parsePaise(flatAmount) : null }),
        ...(freeAbove !== undefined && { freeAbovePaise: freeAbove ? parsePaise(freeAbove) : null }),
        ...(codSurcharge !== undefined && { codSurchargePaise: codSurcharge ? parsePaise(codSurcharge) : null }),
        ...(codSurchargePercent !== undefined && { codSurchargePercent: parseFloat(codSurchargePercent) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      include: { slabs: true },
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error("PATCH /api/admin/shipping/rates/:id error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update rate" },
      { status: 500 }
    );
  }
}
