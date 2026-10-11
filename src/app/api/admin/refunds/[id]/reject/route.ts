import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, FINANCE_ROLES } from "@/lib/api-guard";
import { rejectRefund } from "@/lib/payments/payment-service";

/**
 * POST /api/admin/refunds/:id/reject
 * Rejects a requested refund with mandatory reason.
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
    const body = await req.json();
    const { reason } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "REJECTION_REASON_REQUIRED: A written rejection reason is mandatory" },
        { status: 422 }
      );
    }

    const updated = await rejectRefund({
      refundId: id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      reason,
    });

    return NextResponse.json({
      message: `Refund ${updated.refundNumber} rejected`,
      data: updated,
    });
  } catch (error: any) {
    console.error("POST /api/admin/refunds/:id/reject error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reject refund" },
      { status: error.statusCode || 500 }
    );
  }
}
