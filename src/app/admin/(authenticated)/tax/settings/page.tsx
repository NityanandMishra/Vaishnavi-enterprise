import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/db";
import TaxSettingsForm from "@/components/admin/tax/TaxSettingsForm";
import { sellerIdentityProblems } from "@/lib/tax/seller";

export const metadata: Metadata = {
  title: "Tax Settings — Admin Portal",
  description: "Configure business GSTIN, origin state, pricing mode, and default fallback tax code.",
};

export default async function TaxSettingsPage() {
  const session = await getServerSession(authOptions);
  const role = ((session?.user as any)?.role || "") as string;

  // TAX-05: Other roles cannot reach the screen at all (CATALOG_MANAGER, OPS_EXECUTIVE)
  if (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "FINANCE") {
    redirect("/admin");
  }

  let [settings, productCount, hsns] = await Promise.all([
    prisma.taxSettings.findFirst({
      include: {
        defaultHsn: {
          select: { id: true, code: true, description: true, rateType: true },
        },
      },
    }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.hsnCode.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, code: true, description: true },
      orderBy: [{ code: "asc" }],
    }),
  ]);

  if (!settings) {
    settings = await prisma.taxSettings.create({
      data: {
        // Seller identity starts empty; it must be entered in Tax Settings before invoicing.
        pricingMode: "EXCLUSIVE",
      },
      include: {
        defaultHsn: {
          select: { id: true, code: true, description: true, rateType: true },
        },
      },
    });
  }

  const isSuperAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  const formatted = {
    id: settings.id,
    sellerStateCode: settings.sellerStateCode,
    sellerGstin: settings.sellerGstin,
    sellerLegalName: settings.sellerLegalName,
    sellerTradeName: settings.sellerTradeName,
    sellerAddressLine1: settings.sellerAddressLine1,
    sellerAddressLine2: settings.sellerAddressLine2,
    sellerCity: settings.sellerCity,
    sellerPincode: settings.sellerPincode,
    sellerPhone: settings.sellerPhone,
    sellerEmail: settings.sellerEmail,
    invoicingProblems: sellerIdentityProblems(settings),
    pricingMode: settings.pricingMode,
    defaultHsnId: settings.defaultHsnId,
    defaultHsn: settings.defaultHsn,
    productCount,
    isSuperAdmin,
  };

  return <TaxSettingsForm initialSettings={formatted} hsns={hsns} />;
}
