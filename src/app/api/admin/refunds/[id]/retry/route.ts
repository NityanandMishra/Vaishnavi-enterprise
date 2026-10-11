import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, FINANCE_ROLES } from "@/lib/api-guard";
import { retryRefund } from "@/lib/payments/payment-service";

/**
 * POST /api/admin/refunds/:id/retry
 * Retries a failed refund.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await guardApiRole(FINANCE_ROLES);
    if (auth.response) return auth.response;
    const user = auth.user;

    const { id } = params;
    const updated = await retryRefund(id, { id: user.id, name: user.name });

    return NextResponse.json({
      message: `Refund ${updated.refundNumber} retried successfully`,
      data: updated,
    });
  } catch (error: any) {
    console.error("POST /api/admin/refunds/:id/retry error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retry refund" },
      { status: error.statusCode || 500 }
    );
  }
}
