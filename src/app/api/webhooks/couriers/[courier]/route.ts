import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ingestTrackingEvent } from "@/lib/shipping/shipping-service";
import crypto from "crypto";
import { safeEqual } from "@/lib/api-guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courier: string }> }
) {
  try {
    const { courier: courierCode } = await params;
    const courier = await prisma.courier.findFirst({
      where: {
        OR: [
          { code: courierCode.toUpperCase() },
          { name: courierCode },
        ],
      },
    });

    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-courier-signature") || req.headers.get("x-webhook-signature");

    // Signature verification (SHIP-07: Invalid signatures are rejected with 401).
    // Fails closed: no configured secret or no signature means the event is rejected.
    const webhookSecret = process.env[`${courier.code}_WEBHOOK_SECRET`] || process.env.COURIER_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error(`Webhook secret not configured for courier ${courier.code}; rejecting event`);
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }

    if (!signature) {
      console.warn(`SECURITY: Missing webhook signature for courier ${courier.code}`);
      return NextResponse.json({ error: "Missing webhook signature" }, { status: 401 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (!safeEqual(signature, expectedSignature)) {
      console.warn(`SECURITY: Invalid webhook signature for courier ${courier.code}`);
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Extract AWB and status
    const awb = payload.awbNumber || payload.awb || payload.tracking_number;
    const status = payload.status;
    const description = payload.description || payload.message || `Status update from ${courier.name}`;
    const location = payload.location || payload.city || "In Transit Hub";
    const eventAt = payload.eventAt || payload.timestamp || new Date().toISOString();

    if (!awb || !status) {
      return NextResponse.json(
        { error: "awb and status are required in webhook payload" },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.findFirst({
      where: {
        courierId: courier.id,
        awbNumber: String(awb).trim(),
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: `Shipment with AWB ${awb} not found for courier ${courier.name}` },
        { status: 404 }
      );
    }

    const result = await ingestTrackingEvent({
      shipmentId: shipment.id,
      status,
      courierStatusCode: payload.statusCode || status,
      description,
      location,
      eventAt,
      source: "COURIER_WEBHOOK",
      rawPayload: payload,
    });

    return NextResponse.json({
      success: true,
      resultStatus: result.status,
      shipmentId: shipment.id,
    });
  } catch (error: any) {
    console.error("Courier webhook processing error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process courier webhook" },
      { status: 500 }
    );
  }
}
