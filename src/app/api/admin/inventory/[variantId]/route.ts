import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/db";
import { getOrCreateInventory, deriveStockStatus } from "@/lib/inventory/inventory-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { variantId } = await params;

  try {
    const inventory = await getOrCreateInventory(variantId);
    if (!inventory) {
      return NextResponse.json({ error: "Variant inventory not found" }, { status: 404 });
    }

    // Reserved orders breakdown
    const pendingOrderItems = await prisma.orderItem.findMany({
      where: {
        variantId,
        order: { status: { in: ["PENDING", "COD_CONFIRMED", "CAPTURED"] } },
      },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            user: { select: { name: true, phone: true } },
          },
        },
      },
    });

    const orders = pendingOrderItems.map((item) => ({
      orderId: item.orderId,
      quantity: item.quantity,
      status: item.order.status,
      createdAt: item.order.createdAt,
      customerName: item.order.user?.name || "Customer",
      customerPhone: item.order.user?.phone || null,
    }));

    return NextResponse.json({
      inventory: {
        id: inventory.id,
        variantId: inventory.variantId,
        onHand: inventory.onHand,
        reserved: inventory.reserved,
        available: inventory.onHand - inventory.reserved,
        lowStockThreshold: inventory.lowStockThreshold ?? 5,
        backorderEnabled: inventory.backorderEnabled,
        status: deriveStockStatus(
          inventory.onHand,
          inventory.reserved,
          inventory.lowStockThreshold ?? 5
        ),
        variant: inventory.variant,
      },
      orders,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "CATALOG_MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { variantId } = await params;
  const body = await request.json();

  try {
    const inventory = await getOrCreateInventory(variantId);

    const updated = await prisma.inventory.update({
      where: { id: inventory.id },
      data: {
        lowStockThreshold:
          body.lowStockThreshold !== undefined
            ? body.lowStockThreshold
            : inventory.lowStockThreshold,
        backorderEnabled:
          body.backorderEnabled !== undefined
            ? body.backorderEnabled
            : inventory.backorderEnabled,
      },
    });

    return NextResponse.json({ success: true, inventory: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
