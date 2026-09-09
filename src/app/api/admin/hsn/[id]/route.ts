import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTaxRead, requireTaxWrite } from "@/lib/tax/auth-helper";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireTaxRead();
    const { id } = params;

    const hsn = await prisma.hsnCode.findUnique({
      where: { id },
      include: {
        rateVersions: {
          orderBy: [{ effectiveFrom: "desc" }],
          include: {
            slabs: {
              orderBy: [{ minPrice: "asc" }],
            },
          },
        },
        categoryMappings: {
          include: {
            category: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        products: {
          select: { id: true, title: true, slug: true },
        },
        _count: {
          select: {
            categoryMappings: true,
            products: true,
          },
        },
      },
    });

    if (!hsn || hsn.deletedAt) {
      return NextResponse.json({ ok: false, error: "HSN code not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: hsn });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireTaxWrite();
    const { id } = params;
    const body = await req.json();

    const hsn = await prisma.hsnCode.findUnique({ where: { id } });
    if (!hsn || hsn.deletedAt) {
      return NextResponse.json({ ok: false, error: "HSN code not found" }, { status: 404 });
    }

    const { description, cessRate, isActive } = body;

    const updated = await prisma.hsnCode.update({
      where: { id },
      data: {
        ...(description !== undefined && { description: description.trim() }),
        ...(cessRate !== undefined && { cessRate: Number(cessRate) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "HSN",
        entityId: hsn.id,
        action: "HSN_UPDATED",
        beforeState: JSON.stringify(hsn),
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
    const user = await requireTaxWrite();
    const { id } = params;

    const hsn = await prisma.hsnCode.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            categoryMappings: true,
            products: true,
          },
        },
      },
    });

    if (!hsn || hsn.deletedAt) {
      return NextResponse.json({ ok: false, error: "HSN code not found" }, { status: 404 });
    }

    const mappedCategories = hsn._count.categoryMappings;
    const usedProducts = hsn._count.products;

    if (mappedCategories > 0 || usedProducts > 0) {
      let reason = `HSN ${hsn.code} is`;
      if (mappedCategories > 0 && usedProducts > 0) {
        reason += ` mapped to ${mappedCategories} ${mappedCategories === 1 ? "category" : "categories"} and used by ${usedProducts} ${usedProducts === 1 ? "product" : "products"}.`;
      } else if (mappedCategories > 0) {
        reason += ` mapped to ${mappedCategories} ${mappedCategories === 1 ? "category" : "categories"}.`;
      } else {
        reason += ` used by ${usedProducts} ${usedProducts === 1 ? "product" : "products"}.`;
      }
      reason += " Remove the mappings first, or deactivate this code.";

      return NextResponse.json({ ok: false, error: reason }, { status: 409 });
    }

    const deleted = await prisma.hsnCode.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "HSN",
        entityId: hsn.id,
        action: "HSN_DELETED",
        beforeState: JSON.stringify(hsn),
      },
    });

    return NextResponse.json({ ok: true, message: `HSN ${hsn.code} deleted.` });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
