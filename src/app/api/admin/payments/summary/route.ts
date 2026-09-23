import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { getPaymentDashboardSummary } from "@/lib/payments/payment-service";

/**
 * GET /api/admin/payments/summary
 * Dashboard tiles, method breakdown bar, and attention strips (S1, PAY-10).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const summary = await getPaymentDashboardSummary();
    return NextResponse.json({ data: summary });
  } catch (error: any) {
    console.error("GET /api/admin/payments/summary error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch dashboard summary" },
      { status: 500 }
    );
  }
}
