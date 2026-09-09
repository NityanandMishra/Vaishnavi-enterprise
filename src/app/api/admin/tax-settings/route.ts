import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { taxSettingsInputSchema } from "@/lib/validations/tax";
import { requireTaxSettingsRead, requireTaxSettingsWrite } from "@/lib/tax/auth-helper";

export async function GET(req: NextRequest) {
  try {
    const user = await requireTaxSettingsRead();

    let settings = await prisma.taxSettings.findFirst({
      include: {
        defaultHsn: {
          select: { id: true, code: true, description: true, rateType: true },
        },
      },
    });

    if (!settings) {
      // Fallback create default if database had none
      settings = await prisma.taxSettings.create({
        data: {
          sellerStateCode: "27",
          sellerGstin: "27AABCV1234K1Z5",
          pricingMode: "EXCLUSIVE",
        },
        include: {
          defaultHsn: {
            select: { id: true, code: true, description: true, rateType: true },
          },
        },
      });
    }

    const productCount = await prisma.product.count({ where: { deletedAt: null } });

    return NextResponse.json({
      ok: true,
      data: {
        ...settings,
        productCount,
        isSuperAdmin: user.role === "SUPER_ADMIN" || user.role === "ADMIN",
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireTaxSettingsWrite();
    const body = await req.json();

    const parsed = taxSettingsInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    let settings = await prisma.taxSettings.findFirst();
    if (!settings) {
      settings = await prisma.taxSettings.create({
        data: {
          sellerStateCode: "27",
          sellerGstin: "27AABCV1234K1Z5",
          pricingMode: "EXCLUSIVE",
        },
      });
    }

    // Heavy gate confirmation if changing pricing mode with existing products (TAX-05)
    if (data.pricingMode !== settings.pricingMode) {
      const productCount = await prisma.product.count({ where: { deletedAt: null } });
      if (productCount > 0 && data.confirmationToken !== "SWITCH") {
        return NextResponse.json(
          {
            ok: false,
            needsSwitchConfirmation: true,
            productCount,
            error: `Switching to ${
              data.pricingMode === "INCLUSIVE" ? "tax-inclusive" : "tax-exclusive"
            } changes what every one of your ${productCount} products charges the customer. Existing orders are unaffected. Type SWITCH to confirm.`,
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.taxSettings.update({
      where: { id: settings.id },
      data: {
        sellerStateCode: data.sellerStateCode,
        sellerGstin: data.sellerGstin,
        pricingMode: data.pricingMode,
        defaultHsnId: data.defaultHsnId || null,
      },
      include: {
        defaultHsn: {
          select: { id: true, code: true, description: true, rateType: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "TAX_SETTINGS",
        entityId: updated.id,
        action: "UPDATE_TAX_SETTINGS",
        beforeState: JSON.stringify(settings),
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
