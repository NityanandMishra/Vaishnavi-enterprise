import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { unitInputSchema } from "@/lib/validations/tax";
import { requireUnitsRead, requireUnitsWrite } from "@/lib/tax/auth-helper";

export async function GET(req: NextRequest) {
  try {
    await requireUnitsRead();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const type = searchParams.get("type");
    const isActive = searchParams.get("isActive");

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { symbol: { contains: search } },
      ];
    }

    if (type && type !== "ALL") {
      where.unitType = type;
    }

    if (isActive !== null && isActive !== undefined && isActive !== "ALL") {
      where.isActive = isActive === "true";
    }

    const units = await prisma.unit.findMany({
      where,
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    const formatted = units.map((u) => ({
      id: u.id,
      name: u.name,
      symbol: u.symbol,
      unitType: u.unitType,
      decimalPrecision: u.decimalPrecision,
      isActive: u.isActive,
      isSystem: u.isSystem,
      productCount: u._count.products,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return NextResponse.json({ ok: true, data: formatted });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUnitsWrite();
    const body = await req.json();

    const parsed = unitInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check duplicate name
    const existing = await prisma.unit.findFirst({
      where: {
        name: { equals: data.name },
        deletedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: `A unit named '${data.name}' already exists.` },
        { status: 409 }
      );
    }

    const unit = await prisma.unit.create({
      data: {
        name: data.name,
        symbol: data.symbol,
        unitType: data.unitType,
        decimalPrecision: data.decimalPrecision,
        isActive: data.isActive,
        isSystem: false,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "UNIT",
        entityId: unit.id,
        action: "UNIT_CREATED",
        afterState: JSON.stringify(unit),
      },
    });

    return NextResponse.json({ ok: true, data: unit }, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
