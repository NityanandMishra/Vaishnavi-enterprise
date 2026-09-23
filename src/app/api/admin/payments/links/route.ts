import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { generatePaymentLink } from "@/lib/payments/payment-service";

/**
 * POST /api/admin/payments/links
 * Generate a fresh payment link for an order (PAY-08).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: "ORDER_ID_REQUIRED" }, { status: 400 });
    }

    const link = await generatePaymentLink(orderId);
    return NextResponse.json({ data: link });
  } catch (error: any) {
    console.error("POST /api/admin/payments/links error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate payment link" },
      { status: 500 }
    );
  }
}
