import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, FINANCE_ROLES } from "@/lib/api-guard";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/payments/:id
 * Transaction detail with event timeline and refunds.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await guardApiRole(FINANCE_ROLES);
    if (auth.response) return auth.response;
    const user = auth.user;

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
