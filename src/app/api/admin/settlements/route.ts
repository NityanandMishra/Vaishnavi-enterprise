import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, FINANCE_ROLES } from "@/lib/api-guard";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/settlements
 * List imported settlements with matching status.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await guardApiRole(FINANCE_ROLES);
    if (auth.response) return auth.response;
    const user = auth.user;

    const settlements = await prisma.settlement.findMany({
      include: {
        reconciliationItems: {
          select: { id: true, status: true, mismatchType: true },
        },
      },
      orderBy: { settlementDate: "desc" },
    });

    const items = settlements.map((s) => {
      const openMismatches = s.reconciliationItems.filter((i) => i.status === "OPEN").length;
      return {
        id: s.id,
        gateway: s.gateway,
        settlementId: s.settlementId,
        settlementDate: s.settlementDate,
        grossPaise: s.grossPaise,
        feesPaise: s.feesPaise,
        taxOnFeesPaise: s.taxOnFeesPaise,
        netPaise: s.netPaise,
        bankReference: s.bankReference,
        transactionCount: s.transactionCount,
        status: s.status,
        openMismatches,
        createdAt: s.createdAt,
      };
    });

    return NextResponse.json({ data: items });
  } catch (error: any) {
    console.error("GET /api/admin/settlements error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch settlements" },
      { status: 500 }
    );
  }
}
