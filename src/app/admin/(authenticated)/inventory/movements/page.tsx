import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import MovementsLedgerClient from "./MovementsLedgerClient";

export const metadata: Metadata = {
  title: "Stock Movements & Audit Ledger — Admin Portal",
};

export default async function MovementsLedgerPage() {
  const movements = await prisma.inventoryMovement.findMany({
    take: 150,
    orderBy: { createdAt: "desc" },
    include: {
      variant: {
        include: {
          product: true,
        },
      },
    },
  });

  const formattedMovements = movements.map((m) => ({
    id: m.id,
    sku: m.variant?.sku || "N/A",
    productTitle: m.variant?.product?.title || "Unknown",
    variantTitle: m.variant?.title || null,
    movementType: m.movementType,
    reasonCode: m.reasonCode,
    quantityDelta: m.quantityDelta,
    onHandAfter: m.onHandAfter,
    reservedAfter: m.reservedAfter,
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    note: m.note,
    createdBy: m.createdBy || "System",
    createdAt: m.createdAt.toISOString(),
  }));

  return <MovementsLedgerClient initialMovements={formattedMovements} />;
}
