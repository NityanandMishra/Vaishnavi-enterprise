import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { trackCodCollection } from "@/lib/payments/payment-service";
import { parsePaise } from "@/lib/money";

/**
 * POST /api/admin/cod/:orderId/collect
 * Mark COD collected upon delivery. Flags discrepancy if collected < expected.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { orderId } = params;
    const body = await req.json().catch(() => ({}));
    const { collectedAmount, collectedAmountPaise, courierId, discrepancyNote } = body;

    const collectedPaise =
      collectedAmountPaise !== undefined
        ? Math.round(collectedAmountPaise)
        : collectedAmount !== undefined
        ? parsePaise(collectedAmount)
        : undefined;

    const collection = await trackCodCollection({
      orderId,
      collectedPaise,
      courierId,
      discrepancyNote,
    });

    return NextResponse.json({
      message: "COD collection recorded",
      data: collection,
    });
  } catch (error: any) {
    console.error("POST /api/admin/cod/:orderId/collect error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record COD collection" },
      { status: 500 }
    );
  }
}
