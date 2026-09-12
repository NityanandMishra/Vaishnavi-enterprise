import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ORDER_TRANSITIONS, OrderStatus } from "@/lib/orders/order-types";

/**
 * GET /api/admin/orders/[id]
 * Implements ORD-02: View full order detail with snapshot integrity.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: orderId }, { orderNumber: orderId }],
        deletedAt: null,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true, // For live rename comparison (ORD-02 AC 1)
                slug: true,
                images: {
                  where: { isMain: true },
                  include: { image: true },
                },
              },
            },
            adjustments: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
        },
        notes: {
          orderBy: { createdAt: "desc" },
        },
        invoice: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Customer lifetime stats (ORD-02 AC 4)
    let customerStats = {
      orderCount: 1,
      lifetimeValue: order.totalAmount,
      firstOrderDate: order.placedAt,
    };

    const customerIdent = order.userId || order.customerPhone || order.customerEmail;
    if (customerIdent) {
      const pastOrders = await prisma.order.findMany({
        where: {
          OR: [
            order.userId ? { userId: order.userId } : {},
            order.customerPhone ? { customerPhone: order.customerPhone } : {},
            order.customerEmail ? { customerEmail: order.customerEmail } : {},
          ].filter((c) => Object.keys(c).length > 0),
          deletedAt: null,
          status: { not: "CANCELLED" },
        },
        select: {
          totalAmount: true,
          placedAt: true,
        },
        orderBy: { placedAt: "asc" },
      });

      if (pastOrders.length > 0) {
        customerStats = {
          orderCount: pastOrders.length,
          lifetimeValue: pastOrders.reduce((sum, o) => sum + o.totalAmount, 0),
          firstOrderDate: pastOrders[0].placedAt,
        };
      }
    }

    // Map items with live product comparison (ORD-02 AC 1)
    const enhancedItems = order.items.map((item) => {
      const liveProductTitle = item.product?.title || null;
      const snapshotTitle = item.productName || item.product?.title || "Item";
      const isRenamed = liveProductTitle && liveProductTitle !== snapshotTitle;

      return {
        ...item,
        displayName: snapshotTitle,
        liveProductTitle,
        isRenamed,
        renameTooltip: isRenamed ? `Product is now called ${liveProductTitle}` : null,
      };
    });

    // Legal next states from state machine
    const currentStatus = order.status as OrderStatus;
    const transitionRule = ORDER_TRANSITIONS[currentStatus] || { legalNext: [], systemOnlyNext: [] };

    // Primary action by status (PRD S2)
    let primaryAction = "";
    if (currentStatus === "PENDING") primaryAction = "Mark Confirmed";
    else if (currentStatus === "CONFIRMED") primaryAction = "Mark Processing";
    else if (currentStatus === "PROCESSING") primaryAction = "Mark Packed";
    else if (currentStatus === "PACKED") primaryAction = "Create shipment";

    // Format shipping & billing addresses
    let parsedShipping: any = {};
    let parsedBilling: any = {};
    try {
      parsedShipping = typeof order.shippingAddress === "string" ? JSON.parse(order.shippingAddress) : order.shippingAddress;
    } catch {
      parsedShipping = {};
    }
    try {
      parsedBilling = order.billingAddress
        ? typeof order.billingAddress === "string"
          ? JSON.parse(order.billingAddress)
          : order.billingAddress
        : parsedShipping;
    } catch {
      parsedBilling = parsedShipping;
    }

    // SLA calculation
    const now = new Date();
    let isSlaBreached = false;
    let slaText = "";
    if (
      order.slaDueAt &&
      ["PENDING", "CONFIRMED", "PROCESSING", "PACKED"].includes(order.status)
    ) {
      const diffMs = order.slaDueAt.getTime() - now.getTime();
      const diffHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
      if (diffMs < 0) {
        isSlaBreached = true;
        slaText = `${diffHours}h over`;
      } else {
        slaText = `${diffHours}h left`;
      }
    }

    return NextResponse.json({
      order: {
        ...order,
        items: enhancedItems,
        parsedShipping,
        parsedBilling,
        isSlaBreached,
        slaText,
        primaryAction,
        legalNextStates: transitionRule.legalNext,
        systemOnlyStates: transitionRule.systemOnlyNext,
        customerStats,
      },
    });
  } catch (error: any) {
    console.error("Error fetching order details:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch order details" },
      { status: 500 }
    );
  }
}
