import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bulkCategoryHsnSchema } from "@/lib/validations/tax";
import { requireTaxWrite } from "@/lib/tax/auth-helper";

export async function POST(req: NextRequest) {
  try {
    const user = await requireTaxWrite();
    const body = await req.json();

    const parsed = bulkCategoryHsnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { categoryIds, hsnId } = parsed.data;

    const hsn = await prisma.hsnCode.findUnique({ where: { id: hsnId } });
    if (!hsn || hsn.deletedAt) {
      return NextResponse.json({ ok: false, error: "HSN code not found" }, { status: 404 });
    }

    await prisma.$transaction(
      categoryIds.map((catId) =>
        prisma.categoryHsnMapping.upsert({
          where: { categoryId: catId },
          create: { categoryId: catId, hsnId },
          update: { hsnId },
        })
      )
    );

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "CATEGORY_HSN_MAPPING",
        entityId: "BULK",
        action: "BULK_MAP_CATEGORY_HSN",
        afterState: JSON.stringify({ categoryIds, hsnCode: hsn.code }),
      },
    });

    return NextResponse.json({
      ok: true,
      message: `${categoryIds.length} categories mapped to HSN ${hsn.code}`,
      count: categoryIds.length,
      hsnCode: hsn.code,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
