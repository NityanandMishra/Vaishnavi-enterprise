import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { initiateRefund } from "@/lib/payments/payment-service";
import { parsePaise } from "@/lib/money";

/**
 * GET /api/admin/refunds
 * List refunds with status and date filters (S4 Refund Queue).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    const refunds = await prisma.refund.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            paymentMethod: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: refunds });
  } catch (error: any) {
    console.error("GET /api/admin/refunds error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch refunds" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/refunds
 * Initiate refund with cap checking and threshold branching (PAY-04, PAY-05).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "ADMIN", "FINANCE"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "FORBIDDEN: Only SUPER_ADMIN and FINANCE can initiate refunds" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { orderId, amount, amountPaise: rawPaise, reasonCode, note, lineIds, method, referenceNumber } = body;

    if (!orderId) {
      return NextResponse.json({ error: "ORDER_ID_REQUIRED" }, { status: 400 });
    }

    const amountPaise = rawPaise !== undefined ? Math.round(rawPaise) : parsePaise(amount);

    const result = await initiateRefund({
      orderId,
      amountPaise,
      reasonCode,
      note,
      lineIds,
      method,
      referenceNumber,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
    });

    if (result.requiresApproval) {
      return NextResponse.json(
        {
          status: "REQUIRES_APPROVAL",
          message: result.message,
          data: result.refund,
        },
        { status: 202 }
      );
    }

    return NextResponse.json(
      {
        status: "COMPLETED",
        message: result.message,
        data: result.refund,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("POST /api/admin/refunds error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate refund" },
      { status: error.statusCode || 500 }
    );
  }
}
