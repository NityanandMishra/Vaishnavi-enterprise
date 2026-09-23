import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { recordCodRemittance } from "@/lib/payments/payment-service";
import { parsePaise } from "@/lib/money";

/**
 * GET /api/admin/cod/remittances
 * List past courier remittances (Tab 3 in S5 COD Collections).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const remittances = await prisma.codRemittance.findMany({
      include: {
        collections: {
          select: { id: true, orderId: true, expectedPaise: true, collectedPaise: true },
        },
      },
      orderBy: { remittanceDate: "desc" },
    });

    return NextResponse.json({ data: remittances });
  } catch (error: any) {
    console.error("GET /api/admin/cod/remittances error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch remittances" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cod/remittances
 * Record courier remittance. Requires explanatory note if variance is non-zero (PAY-07).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json();
    const {
      courierId,
      periodStart,
      periodEnd,
      expectedAmount,
      expectedPaise: rawExpected,
      receivedAmount,
      receivedPaise: rawReceived,
      bankReference,
      note,
      orderIds,
    } = body;

    if (!courierId) {
      return NextResponse.json({ error: "COURIER_ID_REQUIRED" }, { status: 400 });
    }

    const expectedPaise =
      rawExpected !== undefined ? Math.round(rawExpected) : parsePaise(expectedAmount);
    const receivedPaise =
      rawReceived !== undefined ? Math.round(rawReceived) : parsePaise(receivedAmount);

    const remittance = await recordCodRemittance({
      courierId,
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      expectedPaise,
      receivedPaise,
      bankReference,
      note,
      orderIds,
      userId: user.id,
      userName: user.name,
    });

    return NextResponse.json({
      message: "COD remittance recorded successfully",
      data: remittance,
    });
  } catch (error: any) {
    console.error("POST /api/admin/cod/remittances error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record remittance" },
      { status: error.statusCode || 500 }
    );
  }
}
