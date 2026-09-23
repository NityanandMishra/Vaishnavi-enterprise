import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";

/**
 * GET /api/admin/settlements/:id/reconciliation
 * Returns settlement financial breakdown and all associated reconciliation mismatch items.
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

    const settlement = await prisma.settlement.findUnique({
      where: { id },
      include: {
        reconciliationItems: {
          include: {
            transaction: {
              include: {
                order: {
                  select: { orderNumber: true, customerName: true, customerPhone: true },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!settlement) {
      return NextResponse.json({ error: "SETTLEMENT_NOT_FOUND" }, { status: 404 });
    }

    const matchedCount =
      settlement.transactionCount - settlement.reconciliationItems.length;

    return NextResponse.json({
      data: {
        settlement,
        summary: {
          grossPaise: settlement.grossPaise,
          feesPaise: settlement.feesPaise,
          taxOnFeesPaise: settlement.taxOnFeesPaise,
          netExpectedPaise: settlement.netPaise,
          bankCreditPaise: settlement.netPaise, // If bank credit matches net expected
          variancePaise: 0,
          totalTransactions: settlement.transactionCount,
          matchedCount: Math.max(0, matchedCount),
          mismatchCount: settlement.reconciliationItems.length,
        },
        mismatches: settlement.reconciliationItems,
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/settlements/:id/reconciliation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch settlement reconciliation" },
      { status: 500 }
    );
  }
}
