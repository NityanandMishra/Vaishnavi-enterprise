import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, ADMIN_ONLY } from "@/lib/api-guard";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/admin/shipping/zone-rules/:id
 * Remove a coverage rule from a zone.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await guardApiRole(ADMIN_ONLY);
    if (auth.response) return auth.response;
    const user = auth.user;

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
