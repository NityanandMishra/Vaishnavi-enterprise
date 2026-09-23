import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
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
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

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
