import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/payments/payment-service";

/**
 * POST /api/webhooks/payments/:gateway
 * Public gateway webhook ingestion endpoint (SEC-02, SEC-03, PAY-02).
 * Signature-verified, idempotently processed, and raw-persisted before handling.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { gateway: string } }
) {
  try {
    const { gateway } = params;
    const rawBody = await req.text();

    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    const signatureHeader =
      headers["x-razorpay-signature"] ||
      headers["signature"] ||
      headers["x-webhook-signature"];

    const result = await processWebhook({
      gateway: gateway.toUpperCase(),
      rawBody,
      headers,
      signatureHeader,
    });

    if (result.status === "INVALID_SIGNATURE") {
      return NextResponse.json(
        { error: "INVALID_SIGNATURE: Webhook signature verification failed" },
        { status: 401 }
      );
    }

    if (result.status === "ORPHANED_ORDER") {
      // 200 acknowledged to gateway so it doesn't repeatedly retry, but flagged in our DB
      return NextResponse.json(
        { status: "ORPHANED_ORDER", message: result.message, logId: result.logId },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { status: result.status, message: result.message, logId: result.logId },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: error.message || "Internal webhook error" },
      { status: 500 }
    );
  }
}
