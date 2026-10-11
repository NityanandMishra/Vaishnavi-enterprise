import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, STAFF_ROLES } from "@/lib/api-guard";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const auth = await guardApiRole(STAFF_ROLES);
  if (auth.response) return auth.response;

  const { variantId } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const type = searchParams.get("type") || undefined;

  try {
    const where: any = { variantId };
    if (type && type !== "ALL") {
      where.movementType = type;
    }

    const movements = await prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.inventoryMovement.count({ where });

    return NextResponse.json({
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
