import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { resolveCodDiscrepancy } from "@/lib/payments/payment-service";

/**
 * POST /api/admin/cod/discrepancies/:id/resolve
 * Resolves a COD discrepancy with a written resolution note. Never silently edits records.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const { resolutionNote } = body;

    if (!resolutionNote || !resolutionNote.trim()) {
      return NextResponse.json(
        { error: "RESOLUTION_NOTE_REQUIRED: A written resolution note is mandatory" },
        { status: 422 }
      );
    }

    const resolved = await resolveCodDiscrepancy({
      collectionId: id,
      resolutionNote,
      userId: user.id,
      userName: user.name,
    });

    return NextResponse.json({
      message: "COD discrepancy resolved",
      data: resolved,
    });
  } catch (error: any) {
    console.error("POST /api/admin/cod/discrepancies/:id/resolve error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resolve discrepancy" },
      { status: error.statusCode || 500 }
    );
  }
}
