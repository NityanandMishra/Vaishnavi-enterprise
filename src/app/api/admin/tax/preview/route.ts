import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { taxPreviewInputSchema } from "@/lib/validations/tax";
import { calculateTax } from "@/lib/tax/tax-engine";
import { requireTaxRead } from "@/lib/tax/auth-helper";

export async function POST(req: NextRequest) {
  try {
    await requireTaxRead();
    const body = await req.json();

    const parsed = taxPreviewInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { price, quantity, discount, hsnId, deliveryStateCode } = parsed.data;

    const [hsn, settings] = await Promise.all([
      prisma.hsnCode.findUnique({
        where: { id: hsnId },
        include: {
          rateVersions: {
            orderBy: [{ effectiveFrom: "desc" }],
            include: { slabs: true },
          },
        },
      }),
      prisma.taxSettings.findFirst(),
    ]);

    if (!hsn || hsn.deletedAt) {
      return NextResponse.json({ ok: false, error: "HSN code not found" }, { status: 404 });
    }

    const sellerStateCode = settings?.sellerStateCode || "27";
    const pricingMode = settings?.pricingMode || "EXCLUSIVE";

    const result = calculateTax({
      unitPrice: price,
      quantity,
      discountPerUnit: discount,
      hsn,
      sellerStateCode,
      deliveryStateCode,
      pricingMode,
    });

    return NextResponse.json({
      ok: true,
      data: {
        perUnitAfterDiscount: result.perUnitAfterDiscount,
        taxableValue: result.taxableValue,
        gstRate: result.gstRate,
        cessRate: result.cessRate,
        cgst: result.cgstAmount,
        sgst: result.sgstAmount,
        igst: result.igstAmount,
        cess: result.cessAmount,
        totalTax: result.totalTax,
        total: result.lineTotal,
        slabApplied: result.slabApplied,
        breakdownNote: result.breakdownNote,
        pricingMode,
        sellerStateCode,
        deliveryStateCode,
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
