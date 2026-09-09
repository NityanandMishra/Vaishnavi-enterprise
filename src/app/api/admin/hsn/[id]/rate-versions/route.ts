import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateVersionInputSchema } from "@/lib/validations/tax";
import { requireTaxWrite } from "@/lib/tax/auth-helper";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireTaxWrite();
    const { id } = params;
    const body = await req.json();

    const hsn = await prisma.hsnCode.findUnique({
      where: { id },
      include: {
        rateVersions: {
          orderBy: [{ effectiveFrom: "desc" }],
        },
      },
    });

    if (!hsn || hsn.deletedAt) {
      return NextResponse.json({ ok: false, error: "HSN code not found" }, { status: 404 });
    }

    const parsed = rateVersionInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const newEffectiveFrom = new Date(data.effectiveFrom);

    // Calculate effectiveTo for the previous version (1 day before newEffectiveFrom)
    const prevEffectiveTo = new Date(newEffectiveFrom);
    prevEffectiveTo.setDate(prevEffectiveTo.getDate() - 1);
    prevEffectiveTo.setHours(23, 59, 59, 999);

    // Find previous active or most recent version to update its effectiveTo
    const priorVersion = hsn.rateVersions.find(
      (v) => new Date(v.effectiveFrom) < newEffectiveFrom && (!v.effectiveTo || new Date(v.effectiveTo) >= newEffectiveFrom)
    ) || hsn.rateVersions[0];

    const result = await prisma.$transaction(async (tx) => {
      if (priorVersion) {
        await tx.hsnRateVersion.update({
          where: { id: priorVersion.id },
          data: { effectiveTo: prevEffectiveTo },
        });
      }

      const created = await tx.hsnRateVersion.create({
        data: {
          hsnId: id,
          gstRate: hsn.rateType === "FLAT" ? data.gstRate : null,
          effectiveFrom: newEffectiveFrom,
          createdBy: user.name,
          ...(hsn.rateType === "SLAB" &&
            data.slabs && {
              slabs: {
                create: data.slabs.map((s) => ({
                  minPrice: s.minPrice,
                  maxPrice: s.maxPrice ?? null,
                  gstRate: s.gstRate,
                })),
              },
            }),
        },
        include: {
          slabs: true,
        },
      });

      return created;
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "HSN",
        entityId: hsn.id,
        action: "HSN_RATE_VERSION_CREATED",
        afterState: JSON.stringify(result),
      },
    });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
