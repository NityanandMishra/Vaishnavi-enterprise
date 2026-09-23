import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { formatPaise, parsePaise } from "@/lib/money";

/**
 * GET /api/admin/payments/export
 * Accountant-ready CSV transaction export honoring active filters (PAY-11).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
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

    const where: any = {};

    if (status && status !== "ALL") where.status = status;
    if (method && method !== "ALL") where.method = method.toUpperCase();
    if (gateway && gateway !== "ALL") where.gateway = gateway.toUpperCase();

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
      ];
    }

    const transactions = await prisma.paymentTransaction.findMany({
      where,
      include: {
        order: {
          select: {
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            taxAmount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    const headers = [
      "Date",
      "Order Number",
      "Customer Name",
      "Customer Phone",
      "Gateway",
      "Gateway Transaction ID",
      "Method",
      "Gross (INR)",
      "Status",
      "Card Last 4",
      "Response Code",
    ];

    const rows = transactions.map((t) => [
      t.createdAt.toISOString().slice(0, 19).replace("T", " "),
      t.order?.orderNumber || t.orderId,
      `"${(t.order?.customerName || "").replace(/"/g, '""')}"`,
      t.order?.customerPhone || "",
      t.gateway,
      t.gatewayTransactionId || "",
      t.method,
      (t.amountPaise / 100).toFixed(2),
      t.status,
      t.cardLastFour || "",
      t.gatewayResponseCode || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transactions_${Date.now()}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/payments/export error:", error);
    return NextResponse.json(
      { error: error.message || "Export failed" },
      { status: 500 }
    );
  }
}
