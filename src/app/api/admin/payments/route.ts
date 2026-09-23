import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { parsePaise } from "@/lib/money";

/**
 * GET /api/admin/payments
 * Query params: page, limit, search, status, method, gateway, dateFrom, dateTo, minAmount, maxAmount
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    // Allow SUPER_ADMIN, ADMIN, FINANCE, OPS_EXECUTIVE (read-only for OPS)
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const method = searchParams.get("method")?.trim();
    const gateway = searchParams.get("gateway")?.trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const minAmount = searchParams.get("minAmount");
    const maxAmount = searchParams.get("maxAmount");

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (method && method !== "ALL") {
      where.method = method.toUpperCase();
    }

    if (gateway && gateway !== "ALL") {
      where.gateway = gateway.toUpperCase();
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

    if (minAmount || maxAmount) {
      where.amountPaise = {};
      if (minAmount) where.amountPaise.gte = parsePaise(minAmount);
      if (maxAmount) where.amountPaise.lte = parsePaise(maxAmount);
    }

    if (search) {
      where.OR = [
        { gatewayTransactionId: { contains: search } },
        { gatewayOrderId: { contains: search } },
        { order: { orderNumber: { contains: search } } },
        { order: { customerPhone: { contains: search } } },
        { order: { customerName: { contains: search } } },
        { upiVpaMasked: { contains: search } },
        { bankName: { contains: search } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
              customerPhone: true,
              status: true,
              paymentStatus: true,
            },
          },
          refunds: {
            where: { status: "COMPLETED" },
            select: { id: true, amountPaise: true, refundNumber: true },
          },
          events: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { signatureVerified: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.paymentTransaction.count({ where }),
    ]);

    const items = transactions.map((t) => {
      const refundedPaise = t.refunds.reduce((sum, r) => sum + r.amountPaise, 0);
      return {
        id: t.id,
        orderId: t.orderId,
        orderNumber: t.order.orderNumber || t.order.id,
        customerName: t.order.customerName || "Customer",
        customerPhone: t.order.customerPhone || "N/A",
        gateway: t.gateway,
        gatewayTransactionId: t.gatewayTransactionId,
        gatewayOrderId: t.gatewayOrderId,
        method: t.method,
        amountPaise: t.amountPaise,
        refundedPaise,
        currency: t.currency,
        status: t.status,
        cardLastFour: t.cardLastFour,
        upiVpaMasked: t.upiVpaMasked,
        bankName: t.bankName,
        gatewayResponseCode: t.gatewayResponseCode,
        gatewayResponseMessage: t.gatewayResponseMessage,
        signatureVerified: t.events[0]?.signatureVerified ?? false,
        initiatedAt: t.initiatedAt,
        completedAt: t.completedAt,
        createdAt: t.createdAt,
      };
    });

    return NextResponse.json({
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/payments error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch payments" },
      { status: 500 }
    );
  }
}
