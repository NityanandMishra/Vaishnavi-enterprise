import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { resolveReconciliationItem } from "@/lib/payments/payment-service";

/**
 * POST /api/admin/reconciliation/:itemId/resolve
 * Resolve or ignore a mismatch with a written resolution note.
 * Never mutates or overwrites raw transactions (PAY-09, FR-23).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "ADMIN", "FINANCE"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "FORBIDDEN: Only SUPER_ADMIN and FINANCE can resolve reconciliation items" },
        { status: 403 }
      );
    }

    const { itemId } = params;
    const body = await req.json();
    const { resolutionNote, action } = body;

    if (!resolutionNote || !resolutionNote.trim()) {
      return NextResponse.json(
        { error: "RESOLUTION_NOTE_REQUIRED: A written resolution note is mandatory" },
        { status: 422 }
      );
    }

    const updated = await resolveReconciliationItem({
      itemId,
      resolutionNote,
      action: action === "IGNORE" ? "IGNORE" : "RESOLVE",
      userId: user.id,
      userName: user.name,
    });

    return NextResponse.json({
      message: `Reconciliation item marked ${updated.status}`,
      data: updated,
    });
  } catch (error: any) {
    console.error("POST /api/admin/reconciliation/:itemId/resolve error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resolve reconciliation item" },
      { status: error.statusCode || 500 }
    );
  }
}
