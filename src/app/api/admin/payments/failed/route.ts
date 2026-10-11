import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, FINANCE_ROLES } from "@/lib/api-guard";
import { getFailedPaymentsQueue } from "@/lib/payments/payment-service";

/**
 * GET /api/admin/payments/failed
 * Failed payment queue sorted newest first with verbatim gateway failure message
 * and stock reservation countdown (PAY-08).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await guardApiRole(FINANCE_ROLES);
    if (auth.response) return auth.response;
    const user = auth.user;

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
