import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { unitInputSchema } from "@/lib/validations/tax";
import { requireUnitsWrite } from "@/lib/tax/auth-helper";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUnitsWrite();
    const { id } = params;
    const body = await req.json();

    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!unit || unit.deletedAt) {
      return NextResponse.json({ ok: false, error: "Unit not found" }, { status: 404 });
    }

    const parsed = unitInputSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check precision change lock (TAX-01: Scenario: Precision locks once in use)
    if (
      data.decimalPrecision !== undefined &&
      data.decimalPrecision !== unit.decimalPrecision &&
      unit._count.products > 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Precision cannot be changed while ${unit._count.products} products use this unit.`,
        },
        { status: 400 }
      );
    }

    // Check name uniqueness if changed
    if (data.name && data.name !== unit.name) {
      const duplicate = await prisma.unit.findFirst({
        where: {
          name: data.name,
          id: { not: id },
          deletedAt: null,
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { ok: false, error: `A unit named '${data.name}' already exists.` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.unit.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.symbol && { symbol: data.symbol }),
        ...(data.unitType && { unitType: data.unitType }),
        ...(data.decimalPrecision !== undefined && { decimalPrecision: data.decimalPrecision }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "UNIT",
        entityId: unit.id,
        action: "UNIT_UPDATED",
        beforeState: JSON.stringify(unit),
        afterState: JSON.stringify(updated),
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUnitsWrite();
    const { id } = params;

    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!unit || unit.deletedAt) {
      return NextResponse.json({ ok: false, error: "Unit not found" }, { status: 404 });
    }

    // 409 if system unit
    if (unit.isSystem) {
      return NextResponse.json(
        {
          ok: false,
          error: `${unit.name} is a system unit and cannot be deleted.`,
        },
        { status: 409 }
      );
    }

    // 409 if in use by products
    if (unit._count.products > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `${unit.name} is used by ${unit._count.products} products and cannot be deleted. Deactivate it instead.`,
        },
        { status: 409 }
      );
    }

    const deleted = await prisma.unit.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "UNIT",
        entityId: unit.id,
        action: "UNIT_DELETED",
        beforeState: JSON.stringify(unit),
      },
    });

    return NextResponse.json({ ok: true, message: `Unit '${unit.name}' deleted.` });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
