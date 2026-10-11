import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, ORDER_READ_ROLES } from "@/lib/api-guard";
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
    const auth = await guardApiRole(ORDER_READ_ROLES);
    if (auth.response) return auth.response;
    const user = auth.user;

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
