import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { approveRefund } from "@/lib/payments/payment-service";

/**
 * POST /api/admin/refunds/:id/approve
 * Approves a high-value refund. Enforces two-person rule (blocks self-approval with 403).
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
    const body = await req.json().catch(() => ({}));

    const updated = await approveRefund({
      refundId: id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      note: body.note,
    });

    return NextResponse.json({
      message: `Refund ${updated.refundNumber} approved and processed`,
      data: updated,
    });
  } catch (error: any) {
    console.error("POST /api/admin/refunds/:id/approve error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to approve refund" },
      { status: error.statusCode || 500 }
    );
  }
}
