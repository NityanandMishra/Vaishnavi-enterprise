import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  createShipment,
  dispatchShipment,
  checkAndFlagStuckShipments,
} from "@/lib/shipping/shipping-service";

/**
 * GET /api/admin/shipments
 * Supports tab counts, multi-field search, filters, pagination.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const courierId = searchParams.get("courierId")?.trim();
    const isStuck = searchParams.get("isStuck") === "true";
    const orderId = searchParams.get("orderId")?.trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // Check stuck parcels first
    await checkAndFlagStuckShipments();

    const where: any = {};

    if (orderId) {
      where.orderId = orderId;
    }

    if (courierId && courierId !== "ALL") {
      where.courierId = courierId;
    }

    if (isStuck) {
      where.isStuck = true;
    }

    // Status filter
    if (status && status !== "ALL") {
      if (status === "EXCEPTIONS") {
        where.OR = [{ status: "FAILED_DELIVERY" }, { isStuck: true }];
      } else if (status === "RTO_GROUP") {
        where.status = { in: ["RTO", "RTO_DELIVERED"] };
      } else {
        where.status = status;
      }
    }

    // Date filters
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // Search filter across AWB, shipment number, order number, customer name
    if (search) {
      where.OR = [
        { shipmentNumber: { contains: search } },
        { awbNumber: { contains: search } },
        { order: { orderNumber: { contains: search } } },
        { order: { customerName: { contains: search } } },
      ];
    }

    const [shipments, total, readyCount, dispatchedCount, inTransitCount, outForDeliveryCount, exceptionCount, deliveredCount, rtoCount] =
      await Promise.all([
        prisma.shipment.findMany({
          where,
          include: {
            courier: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerName: true,
                customerPhone: true,
                shippingAddress: true,
                deliveryStateCode: true,
                deliveryZone: true,
                totalAmount: true,
                paymentMethod: true,
                paymentStatus: true,
                items: {
                  where: { status: "ACTIVE" },
                  select: { id: true, quantity: true, productName: true },
                },
              },
            },
            lines: {
              include: {
                orderLine: {
                  select: {
                    id: true,
                    productName: true,
                    quantity: true,
                  },
                },
              },
            },
            events: {
              orderBy: { eventAt: "desc" },
              take: 1,
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.shipment.count({ where }),
        prisma.shipment.count({ where: { status: { in: ["PENDING", "READY_TO_SHIP"] } } }),
        prisma.shipment.count({ where: { status: "DISPATCHED" } }),
        prisma.shipment.count({ where: { status: "IN_TRANSIT" } }),
        prisma.shipment.count({ where: { status: "OUT_FOR_DELIVERY" } }),
        prisma.shipment.count({
          where: { OR: [{ status: "FAILED_DELIVERY" }, { isStuck: true }] },
        }),
        prisma.shipment.count({ where: { status: "DELIVERED" } }),
        prisma.shipment.count({ where: { status: { in: ["RTO", "RTO_DELIVERED"] } } }),
      ]);

    return NextResponse.json({
      shipments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts: {
        readyToShip: readyCount,
        dispatched: dispatchedCount,
        inTransit: inTransitCount,
        outForDelivery: outForDeliveryCount,
        exceptions: exceptionCount,
        delivered: deliveredCount,
        rto: rtoCount,
      },
    });
  } catch (error: any) {
    console.error("List shipments error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list shipments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/shipments
 * Creates a shipment from a PACKED order.
 * Optionally dispatches immediately if requested.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, lines, courierId, weightGrams, awbNumber, dispatchImmediately } = body;

    if (!orderId || !courierId || !lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: "orderId, courierId, and non-empty lines array are required" },
        { status: 400 }
      );
    }

    const shipment = await createShipment({
      orderId,
      courierId,
      lines,
      weightGrams: weightGrams ? parseInt(weightGrams, 10) : undefined,
      awbNumber,
      userId: user.id,
      userName: user.name || user.email,
    });

    if (dispatchImmediately) {
      const dispatched = await dispatchShipment({
        shipmentId: shipment.id,
        awbNumber,
        userId: user.id,
        userName: user.name || user.email,
      });
      return NextResponse.json({ shipment: dispatched }, { status: 201 });
    }

    return NextResponse.json({ shipment }, { status: 201 });
  } catch (error: any) {
    console.error("Create shipment error:", error);
    const status = error.statusCode || 400;
    return NextResponse.json({ error: error.message || "Failed to create shipment" }, { status });
  }
}
