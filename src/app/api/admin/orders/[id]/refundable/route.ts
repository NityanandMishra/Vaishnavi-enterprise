import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { getRefundableBreakdown } from "@/lib/payments/payment-service";

/**
 * GET /api/admin/orders/:id/refundable
 * Returns order's refundable breakdown based on active items and stored line taxes.
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
    const breakdown = await getRefundableBreakdown(id);

    return NextResponse.json({ data: breakdown });
  } catch (error: any) {
    console.error("GET /api/admin/orders/:id/refundable error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch refundable breakdown" },
      { status: error.statusCode || 500 }
    );
  }
}
