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
    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${id}`);
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
