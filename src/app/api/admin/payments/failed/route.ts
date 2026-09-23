import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { getFailedPaymentsQueue } from "@/lib/payments/payment-service";

/**
 * GET /api/admin/payments/failed
 * Failed payment queue sorted newest first with verbatim gateway failure message
 * and stock reservation countdown (PAY-08).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const queue = await getFailedPaymentsQueue();
    return NextResponse.json({ data: queue });
  } catch (error: any) {
    console.error("GET /api/admin/payments/failed error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch failed payments" },
      { status: 500 }
    );
  }
}
