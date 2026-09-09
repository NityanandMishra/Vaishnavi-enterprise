import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateTax } from "@/lib/tax/tax-engine";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const priceStr = searchParams.get("price");
    const quantityStr = searchParams.get("quantity") || "1";
    const discountStr = searchParams.get("discount") || "0";
    const deliveryStateCode = searchParams.get("deliveryStateCode");
    const atDateStr = searchParams.get("atDate");

    if (!productId || !priceStr || !deliveryStateCode) {
      return NextResponse.json(
        { ok: false, error: "Missing required query parameters: productId, price, deliveryStateCode" },
        { status: 400 }
      );
    }

    const price = parseFloat(priceStr);
    const quantity = parseInt(quantityStr, 10);
    const discount = parseFloat(discountStr);
    const atDate = atDateStr ? new Date(atDateStr) : new Date();

    const [product, settings] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        include: {
          category: {
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
          },
          hsnRel: {
            include: {
              rateVersions: {
                orderBy: [{ effectiveFrom: "desc" }],
                include: { slabs: true },
              },
            },
          },
        },
      }),
      prisma.taxSettings.findFirst({
        include: {
          defaultHsn: {
            include: {
              rateVersions: {
                orderBy: [{ effectiveFrom: "desc" }],
                include: { slabs: true },
              },
            },
          },
        },
      }),
    ]);

    if (!product) {
      return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
    }

    // Resolve HSN hierarchy:
    // 1. Product override
    // 2. Category direct mapping
    // 3. Category parent mapping
    // 4. Default HSN from settings
    let resolvedHsn: any = null;
    let source = "NONE";

    if (product.hsnRel && !product.hsnRel.deletedAt) {
      resolvedHsn = product.hsnRel;
      source = "PRODUCT_OVERRIDE";
    } else if (product.category?.hsnMapping?.hsn && !product.category.hsnMapping.hsn.deletedAt) {
      resolvedHsn = product.category.hsnMapping.hsn;
      source = "CATEGORY_DIRECT";
    } else if (product.category?.parent?.hsnMapping?.hsn && !product.category.parent.hsnMapping.hsn.deletedAt) {
      resolvedHsn = product.category.parent.hsnMapping.hsn;
      source = "CATEGORY_INHERITED";
    } else if (settings?.defaultHsn && !settings.defaultHsn.deletedAt) {
      resolvedHsn = settings.defaultHsn;
      source = "PLATFORM_DEFAULT";
    }

    // TAX-06 Scenario: A product with no resolvable HSN blocks the order
    if (!resolvedHsn) {
      return NextResponse.json(
        {
          ok: false,
          error: `Product '${product.title}' has no tax classification`,
          code: "MISSING_HSN_CLASSIFICATION",
        },
        { status: 422 }
      );
    }

    const sellerStateCode = settings?.sellerStateCode || "27";
    const pricingMode = settings?.pricingMode || "EXCLUSIVE";

    const taxResult = calculateTax({
      unitPrice: price,
      quantity,
      discountPerUnit: discount,
      hsn: resolvedHsn,
      sellerStateCode,
      deliveryStateCode,
      pricingMode,
      atDate,
    });

    // Exact snapshot fields for OrderItem (never live FK lookup)
    const orderLineSnapshot = {
      hsnCode: resolvedHsn.code,
      gstRate: taxResult.gstRate,
      cgstAmount: taxResult.cgstAmount,
      sgstAmount: taxResult.sgstAmount,
      igstAmount: taxResult.igstAmount,
      cessAmount: taxResult.cessAmount,
      taxableValue: taxResult.taxableValue,
      totalTax: taxResult.totalTax,
      lineTotal: taxResult.lineTotal,
      hsnSource: source,
      breakdownNote: taxResult.breakdownNote,
    };

    return NextResponse.json({ ok: true, data: orderLineSnapshot });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
