import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import UnitsManager, { UnitItem } from "@/components/admin/tax/UnitsManager";

export const metadata: Metadata = {
  title: "Units & Measures — Admin Portal",
  description: "Maintain units of measure, precision rules, and symbols across Vaishnavi Enterprise products.",
};

export default async function UnitsPage() {
  const units = await prisma.unit.findMany({
    where: { deletedAt: null },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  const formatted: UnitItem[] = units.map((u) => ({
    id: u.id,
    name: u.name,
    symbol: u.symbol,
    unitType: u.unitType,
    decimalPrecision: u.decimalPrecision,
    isActive: u.isActive,
    isSystem: u.isSystem,
    productCount: u._count.products,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));

  return <UnitsManager initialUnits={formatted} />;
}
