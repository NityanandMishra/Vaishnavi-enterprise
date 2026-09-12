import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createManualOrder } from "@/lib/orders/order-service";

/**
 * GET /api/admin/orders
 * Implements ORD-01 (Triage-first Needs Action view) and ORD-06 (Multi-field Search & Filters).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const view = searchParams.get("view") || "needs_action"; // "needs_action" | "all"
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const paymentStatus = searchParams.get("paymentStatus")?.trim();
    const paymentMethod = searchParams.get("paymentMethod")?.trim();
    const stateCode = searchParams.get("stateCode")?.trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const minAmount = searchParams.get("minAmount") ? parseFloat(searchParams.get("minAmount")!) : undefined;
    const maxAmount = searchParams.get("maxAmount") ? parseFloat(searchParams.get("maxAmount")!) : undefined;
    const slaBreached = searchParams.get("slaBreached") === "true";

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const now = new Date();

    // Base WHERE conditions
    const where: any = {
      deletedAt: null,
    };

    // View filter: Needs action view defaults to PENDING, CONFIRMED, PROCESSING, PACKED
    if (view === "needs_action") {
      if (status && status !== "ALL") {
        where.status = status;
      } else {
        where.status = {
          in: ["PENDING", "CONFIRMED", "PROCESSING", "PACKED"],
        };
      }
    } else {
      if (status && status !== "ALL") {
        where.status = status;
      }
    }

    // Payment filters
    if (paymentStatus && paymentStatus !== "ALL") {
      where.paymentStatus = paymentStatus;
    }
    if (paymentMethod && paymentMethod !== "ALL") {
      where.paymentMethod = paymentMethod;
    }

    // State filter
    if (stateCode && stateCode !== "ALL") {
      where.deliveryStateCode = stateCode;
    }

    // Amount range
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.totalAmount = {};
      if (minAmount !== undefined) where.totalAmount.gte = minAmount;
      if (maxAmount !== undefined) where.totalAmount.lte = maxAmount;
    }

    // Date range
    if (dateFrom || dateTo) {
      where.placedAt = {};
      if (dateFrom) where.placedAt.gte = new Date(dateFrom);
      if (dateTo) where.placedAt.lte = new Date(dateTo);
    }

    // SLA breached filter (ORD-10)
    if (slaBreached) {
      where.status = { in: ["PENDING", "CONFIRMED", "PROCESSING", "PACKED"] };
      where.slaDueAt = { lt: now };
    }

    // Search matches order number, customer name, phone, email, and item SKU (ORD-06)
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { customerEmail: { contains: search } },
        { id: { contains: search } },
        {
          items: {
            some: {
              OR: [
                { sku: { contains: search } },
                { productName: { contains: search } },
              ],
            },
          },
        },
      ];
    }

    // Sort order: FIFO (oldest first) in Needs action view, newest first in All orders view (ORD-01)
    const customSort = searchParams.get("sort");
    const customOrder = searchParams.get("order") || "desc";

    let orderBy: any = {};
    if (customSort) {
      orderBy[customSort] = customOrder;
    } else if (view === "needs_action") {
      orderBy = { placedAt: "asc" }; // FIFO for fulfilment queue
    } else {
      orderBy = { placedAt: "desc" }; // Newest first for general browsing
    }

    // Query orders and counts in parallel
    const [orders, total, needsActionCount, slaBreachedCount, totalAllOrders] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: {
                  title: true,
                  images: {
                    where: { isMain: true },
                    include: { image: true },
                  },
                },
              },
            },
          },
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
      prisma.order.count({
        where: {
          deletedAt: null,
          status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "PACKED"] },
        },
      }),
      prisma.order.count({
        where: {
          deletedAt: null,
          status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "PACKED"] },
          slaDueAt: { lt: now },
        },
      }),
      prisma.order.count({
        where: { deletedAt: null },
      }),
    ]);

    // Enhance each order with SLA computation
    const enhancedOrders = orders.map((order) => {
      let isBreached = false;
      let slaText = "";
      if (
        order.slaDueAt &&
        ["PENDING", "CONFIRMED", "PROCESSING", "PACKED"].includes(order.status)
      ) {
        const diffMs = order.slaDueAt.getTime() - now.getTime();
        const diffHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
        if (diffMs < 0) {
          isBreached = true;
          slaText = `${diffHours}h over`;
        } else {
          slaText = `${diffHours}h left`;
        }
      }

      // Next legal transition recommendation for the row button (ORD-01 AC 3)
      let nextActionLabel = "";
      if (order.status === "PENDING") nextActionLabel = "Mark Confirmed";
      else if (order.status === "CONFIRMED") nextActionLabel = "Mark Processing";
      else if (order.status === "PROCESSING") nextActionLabel = "Mark Packed";
      else if (order.status === "PACKED") nextActionLabel = "Create shipment";

      return {
        ...order,
        isSlaBreached: isBreached,
        slaText,
        nextActionLabel,
        itemCount: order.items.reduce((s, i) => s + (i.quantity - (i.cancelledQty || 0)), 0),
      };
    });

    return NextResponse.json({
      orders: enhancedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts: {
        needsAction: needsActionCount,
        slaBreached: slaBreachedCount,
        totalAll: totalAllOrders,
      },
    });
  } catch (error: any) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/orders
 * Creates a manual order (ORD-12).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await createManualOrder(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating manual order:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create manual order" },
      { status: 400 }
    );
  }
}
