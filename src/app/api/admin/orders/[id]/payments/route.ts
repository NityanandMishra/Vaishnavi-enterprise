import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";

/**
 * GET /api/admin/orders/:id/payments
 * Implements A.8 API Contract: Retrieve all payment attempts, transactions,
 * events, and refund records attached to a specific order.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = params;

    // Resolve order by either ID or orderNumber
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
        deletedAt: null,
      },
      select: { id: true, orderNumber: true, paymentStatus: true, totalAmount: true, paidAmount: true, balanceAmount: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const transactions = await prisma.paymentTransaction.findMany({
      where: { orderId: order.id },
      include: {
        events: {
          orderBy: { createdAt: "desc" },
        },
        refunds: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        paidAmount: order.paidAmount,
        balanceAmount: order.balanceAmount,
        transactions,
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/orders/:id/payments error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch order payments" },
      { status: error.statusCode || 500 }
    );
  }
}
