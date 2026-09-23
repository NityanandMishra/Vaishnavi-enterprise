import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { rupeesToPaise } from "@/lib/money";

/**
 * GET /api/admin/cod/discrepancies
 * S5 COD Collections (Tab 4):
 * - Short collection (collectedPaise < expectedPaise)
 * - Delivered > 48h with no collection recorded
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // 1. Explicit DISCREPANCY collections
    const explicitDiscrepancies = await prisma.codCollection.findMany({
      where: { status: "DISCREPANCY" },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            deliveredAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 2. Orders marked delivered > 48h ago with no cash recorded (FR-20)
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const deliveredNoCashOrders = await prisma.order.findMany({
      where: {
        paymentMethod: "COD",
        status: "DELIVERED",
        paymentStatus: "PENDING",
        deliveredAt: { lte: fortyEightHoursAgo },
        codCollection: null,
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        totalAmount: true,
        deliveredAt: true,
      },
      orderBy: { deliveredAt: "asc" },
    });

    const deliveredNoCashItems = deliveredNoCashOrders.map((o) => ({
      id: `orphan_${o.id}`,
      orderId: o.id,
      orderNumber: o.orderNumber || o.id,
      customerName: o.customerName || "Customer",
      customerPhone: o.customerPhone || "N/A",
      expectedPaise: rupeesToPaise(o.totalAmount),
      collectedPaise: 0,
      variancePaise: rupeesToPaise(o.totalAmount),
      deliveredAt: o.deliveredAt,
      type: "DELIVERED_NO_CASH",
      discrepancyNote: "Delivered > 48h ago with no cash collection recorded",
      status: "DISCREPANCY",
    }));

    const formattedExplicit = explicitDiscrepancies.map((c) => ({
      id: c.id,
      orderId: c.orderId,
      orderNumber: c.order.orderNumber || c.order.id,
      customerName: c.order.customerName || "Customer",
      customerPhone: c.order.customerPhone || "N/A",
      expectedPaise: c.expectedPaise,
      collectedPaise: c.collectedPaise || 0,
      variancePaise: c.expectedPaise - (c.collectedPaise || 0),
      deliveredAt: c.order.deliveredAt || c.collectedAt,
      type: "SHORT_COLLECTION",
      discrepancyNote: c.discrepancyNote || "Short collection",
      status: c.status,
    }));

    return NextResponse.json({
      data: [...formattedExplicit, ...deliveredNoCashItems],
    });
  } catch (error: any) {
    console.error("GET /api/admin/cod/discrepancies error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch COD discrepancies" },
      { status: 500 }
    );
  }
}
