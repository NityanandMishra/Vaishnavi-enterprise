import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { importSettlement } from "@/lib/payments/payment-service";
import { parsePaise } from "@/lib/money";

/**
 * POST /api/admin/settlements/import
 * Import gateway settlement file or JSON payload (PAY-09).
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
        { error: "FORBIDDEN: Only SUPER_ADMIN and FINANCE can import settlements" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      gateway,
      settlementId,
      settlementDate,
      bankReference,
      grossAmount,
      grossPaise: rawGross,
      feesAmount,
      feesPaise: rawFees,
      taxOnFeesAmount,
      taxOnFeesPaise: rawTax,
      netAmount,
      netPaise: rawNet,
      transactions,
    } = body;

    if (!settlementId || !transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD: settlementId and transactions array are required" },
        { status: 400 }
      );
    }

    const grossPaise = rawGross !== undefined ? Math.round(rawGross) : parsePaise(grossAmount);
    const feesPaise = rawFees !== undefined ? Math.round(rawFees) : parsePaise(feesAmount);
    const taxOnFeesPaise = rawTax !== undefined ? Math.round(rawTax) : parsePaise(taxOnFeesAmount);
    const netPaise = rawNet !== undefined ? Math.round(rawNet) : parsePaise(netAmount);

    const formattedTransactions = transactions.map((t: any) => ({
      gatewayTransactionId: t.gatewayTransactionId || t.txnId || t.id,
      orderNumber: t.orderNumber || t.order_number,
      amountPaise: t.amountPaise !== undefined ? Math.round(t.amountPaise) : parsePaise(t.amount),
      status: (t.status || "PAID").toUpperCase(),
      feePaise: t.feePaise !== undefined ? Math.round(t.feePaise) : parsePaise(t.fee),
      taxOnFeePaise: t.taxOnFeePaise !== undefined ? Math.round(t.taxOnFeePaise) : parsePaise(t.taxOnFee),
      date: t.date,
    }));

    const result = await importSettlement({
      gateway: gateway || "RAZORPAY",
      settlementId,
      settlementDate: settlementDate ? new Date(settlementDate) : new Date(),
      bankReference,
      grossPaise,
      feesPaise,
      taxOnFeesPaise,
      netPaise,
      transactions: formattedTransactions,
      userId: user.id,
      userName: user.name,
    });

    return NextResponse.json({
      message: `Settlement ${settlementId} imported: ${result.matchedCount} matched, ${result.mismatchCount} need attention`,
      data: result,
    });
  } catch (error: any) {
    console.error("POST /api/admin/settlements/import error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import settlement" },
      { status: 500 }
    );
  }
}
