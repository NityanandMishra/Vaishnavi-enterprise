import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, ADMIN_ONLY } from "@/lib/api-guard";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/admin/couriers/:id
 */
export async function PATCH(
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
    const body = await req.json();
    const { name, integrationMode, supportsCod, supportsReverse, priority, isActive } = body;

    const updated = await prisma.courier.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(integrationMode && { integrationMode }),
        ...(supportsCod !== undefined && { supportsCod: Boolean(supportsCod) }),
        ...(supportsReverse !== undefined && { supportsReverse: Boolean(supportsReverse) }),
        ...(priority !== undefined && { priority: parseInt(priority, 10) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error("PATCH /api/admin/couriers/:id error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update courier" },
      { status: 500 }
    );
  }
}
