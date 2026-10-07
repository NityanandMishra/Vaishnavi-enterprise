import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/tax/auth-helper";
import { createShippingZone, initDefaultShippingData } from "@/lib/shipping/shipping-service";

/**
 * GET /api/admin/shipping/zones
 * Lists all shipping zones with coverage rules and active rate configuration.
 * POST /api/admin/shipping/zones
 * Creates a new shipping zone (SUPER_ADMIN only).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    await initDefaultShippingData();

    const zones = await prisma.shippingZone.findMany({
      where: { deletedAt: null },
      include: {
        rules: { orderBy: { specificity: "desc" } },
        rates: {
          where: { isActive: true },
          include: { slabs: { orderBy: { minWeightGrams: "asc" } } },
        },
      },
      orderBy: [{ isFallback: "desc" }, { priority: "asc" }],
    });

    return NextResponse.json({ data: zones });
  } catch (error: any) {
    console.error("GET /api/admin/shipping/zones error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch shipping zones" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN: Only SUPER_ADMIN can configure shipping zones" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, priority, isFallback } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Zone name is required" }, { status: 422 });
    }

    const zone = await createShippingZone({
      name: name.trim(),
      priority: priority !== undefined ? parseInt(priority, 10) : 0,
      isFallback: Boolean(isFallback),
    });

    return NextResponse.json({ data: zone }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/shipping/zones error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create shipping zone" },
      { status: error.statusCode || 500 }
    );
  }
}
