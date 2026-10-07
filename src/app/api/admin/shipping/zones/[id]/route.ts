import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { deleteShippingZone } from "@/lib/shipping/shipping-service";

/**
 * PATCH /api/admin/shipping/zones/:id
 * DELETE /api/admin/shipping/zones/:id (409 if fallback or in use)
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
    const { name, priority, isFallback, isActive } = body;

    if (isFallback) {
      await prisma.shippingZone.updateMany({
        where: { isFallback: true, id: { not: id } },
        data: { isFallback: false },
      });
    }

    const updated = await prisma.shippingZone.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(priority !== undefined && { priority: parseInt(priority, 10) }),
        ...(isFallback !== undefined && { isFallback: Boolean(isFallback) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      include: { rules: true, rates: { include: { slabs: true } } },
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error("PATCH /api/admin/shipping/zones/:id error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update zone" },
      { status: 500 }
    );
  }
}

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
    const deleted = await deleteShippingZone(id);

    return NextResponse.json({
      message: `Zone '${deleted.name}' deleted successfully`,
      data: deleted,
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/shipping/zones/:id error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete zone" },
      { status: error.statusCode || 500 }
    );
  }
}
