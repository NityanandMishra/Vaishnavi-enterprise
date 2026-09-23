import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";

/**
 * GET /api/admin/payments/:id
 * Transaction detail with event timeline and refunds.
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

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            customerEmail: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            paidAmount: true,
          },
        },
        events: {
          orderBy: { createdAt: "asc" },
        },
        refunds: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "TRANSACTION_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ data: transaction });
  } catch (error: any) {
    console.error("GET /api/admin/payments/:id error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch transaction" },
      { status: 500 }
    );
  }
}
