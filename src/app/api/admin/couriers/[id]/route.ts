import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";

/**
 * PATCH /api/admin/couriers/:id
 */
export async function PATCH(
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
