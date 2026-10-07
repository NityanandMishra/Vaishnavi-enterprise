import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";

/**
 * DELETE /api/admin/shipping/zone-rules/:id
 * Remove a coverage rule from a zone.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = params;
    const rule = await prisma.zoneRule.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Coverage rule removed successfully",
      data: rule,
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/shipping/zone-rules/:id error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete coverage rule" },
      { status: 500 }
    );
  }
}
