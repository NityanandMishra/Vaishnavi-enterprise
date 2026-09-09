import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hsnInputSchema } from "@/lib/validations/tax";
import { requireTaxRead, requireTaxWrite } from "@/lib/tax/auth-helper";

export async function GET(req: NextRequest) {
  try {
    await requireTaxRead();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const rateType = searchParams.get("rateType");
    const isActive = searchParams.get("isActive");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (rateType && rateType !== "ALL") {
      where.rateType = rateType;
    }

    if (isActive !== null && isActive !== undefined && isActive !== "ALL") {
      where.isActive = isActive === "true";
    }

    const [total, hsnList] = await Promise.all([
      prisma.hsnCode.count({ where }),
      prisma.hsnCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ code: "asc" }],
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
          _count: {
            select: {
              products: true,
              categoryMappings: true,
            },
          },
        },
      }),
    ]);

    const now = new Date();

    const formatted = hsnList.map((hsn) => {
      // Find active rate version (effectiveFrom <= now and (effectiveTo is null or >= now))
      const versions = hsn.rateVersions;
      let activeVersion = versions.find(
        (v) => new Date(v.effectiveFrom) <= now && (!v.effectiveTo || new Date(v.effectiveTo) >= now)
      );

      if (!activeVersion && versions.length > 0) {
        // Fallback: earliest or latest
        activeVersion = versions[0];
      }

      // Check if there is a future-dated version (TAX-07)
      const futureVersion = versions.find((v) => new Date(v.effectiveFrom) > now);

      let rateDisplay = "";
      if (hsn.rateType === "SLAB") {
        const slabs = activeVersion?.slabs || [];
        if (slabs.length > 0) {
          const rates = slabs.map((s) => `${s.gstRate}%`);
          const uniqueRates = Array.from(new Set(rates));
          rateDisplay = uniqueRates.join(" / ");
        } else {
          rateDisplay = "Slab";
        }
      } else {
        rateDisplay = activeVersion ? `${activeVersion.gstRate}%` : "—";
      }

      let futureRateDisplay = null;
      if (futureVersion) {
        const fromStr = new Date(futureVersion.effectiveFrom).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        if (hsn.rateType === "SLAB") {
          const rates = (futureVersion.slabs || []).map((s) => `${s.gstRate}%`);
          futureRateDisplay = `${Array.from(new Set(rates)).join(" / ")} from ${fromStr}`;
        } else {
          futureRateDisplay = `${futureVersion.gstRate}% from ${fromStr}`;
        }
      }

      return {
        id: hsn.id,
        code: hsn.code,
        description: hsn.description,
        rateType: hsn.rateType,
        cessRate: hsn.cessRate,
        isActive: hsn.isActive,
        activeRateVersion: activeVersion,
        futureVersion: futureVersion || null,
        rateDisplay,
        futureRateDisplay,
        slabs: activeVersion?.slabs || [],
        categoriesCount: hsn._count.categoryMappings,
        productsCount: hsn._count.products,
        categories: hsn.categoryMappings.map((cm) => cm.category),
        rateVersionsCount: hsn.rateVersions.length,
        createdAt: hsn.createdAt,
        updatedAt: hsn.updatedAt,
      };
    });

    return NextResponse.json({
      ok: true,
      data: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireTaxWrite();
    const body = await req.json();

    const parsed = hsnInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check duplicate code
    const existing = await prisma.hsnCode.findFirst({
      where: {
        code: data.code,
        deletedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: `HSN code ${data.code} already exists`, existingId: existing.id },
        { status: 409 }
      );
    }

    // Create HSN with its initial rate version
    const effectiveFromDate = new Date(data.effectiveFrom);

    const hsn = await prisma.hsnCode.create({
      data: {
        code: data.code,
        description: data.description,
        rateType: data.rateType,
        cessRate: data.cessRate ?? 0,
        isActive: data.isActive,
        rateVersions: {
          create: {
            gstRate: data.rateType === "FLAT" ? data.gstRate : null,
            effectiveFrom: effectiveFromDate,
            createdBy: user.name,
            ...(data.rateType === "SLAB" &&
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
        },
      },
      include: {
        rateVersions: {
          include: { slabs: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "HSN",
        entityId: hsn.id,
        action: "HSN_CREATED",
        afterState: JSON.stringify(hsn),
      },
    });

    return NextResponse.json({ ok: true, data: hsn }, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
