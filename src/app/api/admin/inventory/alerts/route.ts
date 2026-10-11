import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, STAFF_ROLES } from "@/lib/api-guard";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await guardApiRole(STAFF_ROLES);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const resolved = searchParams.get("resolved") === "true";

  try {
    const where: any = {};
    if (type) where.alertType = type;
    if (!resolved) where.resolvedAt = null;

    const alerts = await prisma.stockAlert.findMany({
      where,
      include: {
        variant: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { triggeredAt: "desc" },
    });

    return NextResponse.json({ alerts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
