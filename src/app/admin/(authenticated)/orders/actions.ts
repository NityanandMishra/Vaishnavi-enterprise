"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getOrders() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, orders };
  } catch (error: any) {
    console.error("Error fetching orders:", error);
    return { success: false, error: error.message || "Failed to fetch orders" };
  }
}

export async function getOrderDetails(id: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                title: true,
                images: {
                  where: {
                    isMain: true,
                  },
                  include: {
                    image: true,
                  },
                },
              },
            },
            variant: {
              select: {
                title: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    return { success: true, order };
  } catch (error: any) {
    console.error(`Error fetching details for order ${id}:`, error);
    return { success: false, error: error.message || "Failed to fetch order details" };
  }
}

export async function updateOrderStatus(id: string, status: string) {
  try {
    const currentOrder = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!currentOrder) {
      return { success: false, error: "Order not found" };
    }

    // Inventory transitions (EPIC-04: INV-04, INV-05)
    if (status === "FULFILLED" && currentOrder.status !== "FULFILLED") {
      const { fulfilStock } = await import("@/lib/inventory/inventory-service");
      const items = currentOrder.items
        .filter((i) => i.variantId)
        .map((i) => ({
          variantId: i.variantId!,
          quantity: i.quantity,
        }));
      if (items.length > 0) {
        await fulfilStock({
          orderId: id,
          items,
        });
      }
    } else if (status === "CANCELLED" && currentOrder.status !== "CANCELLED") {
      const { releaseStock } = await import("@/lib/inventory/inventory-service");
      await releaseStock({
        orderId: id,
        reason: "Order cancelled by admin",
      });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/inventory");
    return { success: true, order };
  } catch (error: any) {
    console.error(`Error updating status for order ${id}:`, error);
    return { success: false, error: error.message || "Failed to update order status" };
  }
}

export async function updateOrderShipping(
  id: string,
  data: {
    shiprocketOrderId?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
  }
) {
  try {
    const order = await prisma.order.update({
      where: { id },
      data: {
        shiprocketOrderId: data.shiprocketOrderId || null,
        trackingNumber: data.trackingNumber || null,
        trackingUrl: data.trackingUrl || null,
      },
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${id}`);
    return { success: true, order };
  } catch (error: any) {
    console.error(`Error updating shipping details for order ${id}:`, error);
    return { success: false, error: error.message || "Failed to update shipping information" };
  }
}
