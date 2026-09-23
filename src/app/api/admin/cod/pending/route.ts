import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { rupeesToPaise } from "@/lib/money";

/**
 * GET /api/admin/cod/pending
 * S5 COD Collections:
 * - Awaiting delivery: COD orders shipped but not yet delivered
 * - Collected, not remitted: Delivered COD orders awaiting bank remittance
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // 1. Awaiting delivery: COD orders in SHIPPED status, not yet delivered
    const awaitingDeliveryOrders = await prisma.order.findMany({
      where: {
        paymentMethod: "COD",
        status: "SHIPPED",
        paymentStatus: "PENDING",
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        totalAmount: true,
        trackingNumber: true,
        shippedAt: true,
        slaDueAt: true,
      },
      orderBy: { shippedAt: "desc" },
    });

    const awaitingDelivery = awaitingDeliveryOrders.map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber || o.id,
      customerName: o.customerName || "Customer",
      customerPhone: o.customerPhone || "N/A",
      amountPaise: rupeesToPaise(o.totalAmount),
      courier: "Delhivery", // default house courier
      awb: o.trackingNumber || "N/A",
      dispatchedAt: o.shippedAt,
      expectedDeliveryAt: o.slaDueAt,
    }));

    const totalAwaitingDeliveryPaise = awaitingDelivery.reduce(
      (sum, o) => sum + o.amountPaise,
      0
    );

    // 2. Collected, not remitted: CodCollections with status "COLLECTED" and no remittanceId
    const unremittedCollections = await prisma.codCollection.findMany({
      where: {
        status: "COLLECTED",
        remittanceId: null,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            deliveredAt: true,
          },
        },
      },
      orderBy: { collectedAt: "desc" },
    });

    // Group unremitted collections by courier
    const courierGroups: Record<
      string,
      {
        courier: string;
        orderCount: number;
        totalExpectedPaise: number;
        orders: Array<{
          collectionId: string;
          orderId: string;
          orderNumber: string;
          customerName: string;
          amountPaise: number;
          deliveredAt: Date | null;
        }>;
      }
    > = {};

    unremittedCollections.forEach((c) => {
      const courier = c.courierId || "Delhivery";
      if (!courierGroups[courier]) {
        courierGroups[courier] = {
          courier,
          orderCount: 0,
          totalExpectedPaise: 0,
          orders: [],
        };
      }
      courierGroups[courier].orderCount += 1;
      courierGroups[courier].totalExpectedPaise += c.expectedPaise;
      courierGroups[courier].orders.push({
        collectionId: c.id,
        orderId: c.orderId,
        orderNumber: c.order.orderNumber || c.order.id,
        customerName: c.order.customerName || "Customer",
        amountPaise: c.collectedPaise || c.expectedPaise,
        deliveredAt: c.order.deliveredAt,
      });
    });

    return NextResponse.json({
      data: {
        awaitingDelivery: {
          items: awaitingDelivery,
          totalAmountPaise: totalAwaitingDeliveryPaise,
          count: awaitingDelivery.length,
        },
        collectedNotRemitted: {
          groups: Object.values(courierGroups),
          totalCount: unremittedCollections.length,
          totalAmountPaise: unremittedCollections.reduce(
            (sum, c) => sum + (c.collectedPaise || c.expectedPaise),
            0
          ),
        },
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/cod/pending error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch pending COD" },
      { status: 500 }
    );
  }
}
