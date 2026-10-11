import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, ADMIN_ONLY, ORDER_READ_ROLES } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { initDefaultShippingData } from "@/lib/shipping/shipping-service";

/**
 * GET /api/admin/couriers
 * POST /api/admin/couriers
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await guardApiRole(ORDER_READ_ROLES);
    if (auth.response) return auth.response;
    const user = auth.user;

    await initDefaultShippingData();

    const couriers = await prisma.courier.findMany({
      include: {
        _count: { select: { serviceability: true, shipments: true } },
      },
      orderBy: { priority: "asc" },
    });

    const safeCouriers = couriers.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      integrationMode: c.integrationMode,
      credentialsStatus: "Configured via environment", // FR-10: never render secret
      supportsCod: c.supportsCod,
      supportsReverse: c.supportsReverse,
      priority: c.priority,
      isActive: c.isActive,
      lastApiStatus: c.lastApiStatus || "HEALTHY",
      lastApiError: c.lastApiError,
      lastApiCheckedAt: c.lastApiCheckedAt,
      serviceablePincodesCount: c._count.serviceability,
      shipmentsCount: c._count.shipments,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ data: safeCouriers });
  } catch (error: any) {
    console.error("GET /api/admin/couriers error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch couriers" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await guardApiRole(ADMIN_ONLY);
    if (auth.response) return auth.response;
    const user = auth.user;

    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json();
    const { name, code, integrationMode, supportsCod, supportsReverse, priority } = body;

    if (!name || !code) {
      return NextResponse.json({ error: "Name and unique code are required" }, { status: 422 });
    }

    const courier = await prisma.courier.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        integrationMode: integrationMode || "API",
        credentialsKey: integrationMode === "API" ? `${code.trim().toUpperCase()}_API_KEY` : null,
        supportsCod: supportsCod ?? true,
        supportsReverse: supportsReverse ?? true,
        priority: priority ? parseInt(priority, 10) : 1,
        isActive: true,
      },
    });

    return NextResponse.json({ data: courier }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/couriers error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create courier" },
      { status: 500 }
    );
  }
}
