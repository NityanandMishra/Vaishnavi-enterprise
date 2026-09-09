import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { categoryHsnMappingSchema } from "@/lib/validations/tax";
import { requireTaxRead, requireTaxWrite } from "@/lib/tax/auth-helper";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireTaxRead();
    const { id } = params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        hsnMapping: {
          include: {
            hsn: {
              include: {
                rateVersions: {
                  orderBy: [{ effectiveFrom: "desc" }],
                  include: { slabs: true },
                },
              },
            },
          },
        },
        parent: {
          include: {
            hsnMapping: {
              include: {
                hsn: {
                  include: {
                    rateVersions: {
                      orderBy: [{ effectiveFrom: "desc" }],
                      include: { slabs: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ ok: false, error: "Category not found" }, { status: 404 });
    }

    if (category.hsnMapping) {
      return NextResponse.json({
        ok: true,
        source: category.parentId ? "Override" : "Direct",
        mapping: category.hsnMapping,
      });
    }

    if (category.parent?.hsnMapping) {
      return NextResponse.json({
        ok: true,
        source: "Inherited",
        mapping: category.parent.hsnMapping,
      });
    }

    return NextResponse.json({
      ok: true,
      source: "Missing",
      mapping: null,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireTaxWrite();
    const { id: categoryId } = params;
    const body = await req.json();

    const parsed = categoryHsnMappingSchema.safeParse({
      categoryId,
      hsnId: body.hsnId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { hsnId } = parsed.data;

    // Verify HSN exists
    const hsn = await prisma.hsnCode.findUnique({ where: { id: hsnId } });
    if (!hsn || hsn.deletedAt) {
      return NextResponse.json({ ok: false, error: "HSN code not found" }, { status: 404 });
    }

    // Upsert mapping
    const mapping = await prisma.categoryHsnMapping.upsert({
      where: { categoryId },
      create: { categoryId, hsnId },
      update: { hsnId },
      include: {
        category: true,
        hsn: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "CATEGORY_HSN_MAPPING",
        entityId: categoryId,
        action: "MAP_CATEGORY_HSN",
        afterState: JSON.stringify({ categoryId, hsnCode: hsn.code }),
      },
    });

    return NextResponse.json({ ok: true, data: mapping });
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
    const { id: categoryId } = params;

    const existing = await prisma.categoryHsnMapping.findUnique({
      where: { categoryId },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Mapping not found" }, { status: 404 });
    }

    await prisma.categoryHsnMapping.delete({
      where: { categoryId },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "CATEGORY_HSN_MAPPING",
        entityId: categoryId,
        action: "REMOVE_CATEGORY_HSN_OVERRIDE",
        beforeState: JSON.stringify(existing),
      },
    });

    return NextResponse.json({ ok: true, message: "Category mapping removed." });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
