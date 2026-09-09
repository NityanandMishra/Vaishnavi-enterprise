import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { getInventoryOverview } from "@/lib/inventory/inventory-service";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "inventory"; // "inventory" | "movements" | "reorder"

  try {
    if (type === "reorder") {
      // S4 Low stock queue reorder list
      const overview = await getInventoryOverview({ limit: 1000 });
      const lowItems = overview.items.filter(
        (i) => i.stockStatus === "LOW_STOCK" || i.stockStatus === "OUT_OF_STOCK"
      );

      const header = [
        "SKU",
        "Product",
        "Variant",
        "Category",
        "Available",
        "Threshold",
        "Suggested Reorder Qty",
      ];
      const rows = lowItems.map((item) => {
        // Suggested reorder quantity: max(0, threshold * 2 - available) (FR-20 / INV-08)
        const suggested = Math.max(0, item.lowStockThreshold * 2 - item.available);
        return [
          `"${item.sku || ""}"`,
          `"${(item.productTitle || "").replace(/"/g, '""')}"`,
          `"${(item.variantTitle || "").replace(/"/g, '""')}"`,
          `"${(item.categoryName || "").replace(/"/g, '""')}"`,
          item.available,
          item.lowStockThreshold,
          suggested,
        ].join(",");
      });

      const csv = [header.join(","), ...rows].join("\r\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="reorder-list-${Date.now()}.csv"`,
        },
      });
    }

    if (type === "movements") {
      // S6 Movements ledger CSV
      const variantId = searchParams.get("variantId") || undefined;
      const where: any = {};
      if (variantId) where.variantId = variantId;

      const movements = await prisma.inventoryMovement.findMany({
        where,
        include: {
          variant: { include: { product: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      const header = [
        "Date/Time",
        "SKU",
        "Product",
        "Variant",
        "Movement Type",
        "Reason Code",
        "Quantity Delta",
        "Balance After",
        "Reference Type",
        "Reference ID",
        "Actor",
        "Note",
      ];

      const rows = movements.map((m) => [
        `"${m.createdAt.toISOString()}"`,
        `"${m.variant?.sku || ""}"`,
        `"${(m.variant?.product?.title || "").replace(/"/g, '""')}"`,
        `"${(m.variant?.title || "").replace(/"/g, '""')}"`,
        `"${m.movementType}"`,
        `"${m.reasonCode}"`,
        m.quantityDelta,
        m.onHandAfter,
        `"${m.referenceType || ""}"`,
        `"${m.referenceId || ""}"`,
        `"${(m.createdBy || "").replace(/"/g, '""')}"`,
        `"${(m.note || "").replace(/"/g, '""')}"`,
      ].join(","));

      const csv = [header.join(","), ...rows].join("\r\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="movements-ledger-${Date.now()}.csv"`,
        },
      });
    }

    // Default: S1 Inventory overview CSV
    const overview = await getInventoryOverview({ limit: 5000 });
    const header = [
      "SKU",
      "Product",
      "Variant",
      "Category",
      "On Hand",
      "Reserved",
      "Available",
      "Threshold",
      "Status",
      "Updated At",
    ];

    const rows = overview.items.map((item) => [
      `"${item.sku || ""}"`,
      `"${(item.productTitle || "").replace(/"/g, '""')}"`,
      `"${(item.variantTitle || "").replace(/"/g, '""')}"`,
      `"${(item.categoryName || "").replace(/"/g, '""')}"`,
      item.onHand,
      item.reserved,
      item.available,
      item.lowStockThreshold,
      `"${item.stockStatus}"`,
      `"${new Date(item.updatedAt).toISOString()}"`,
    ].join(","));

    const csv = [header.join(","), ...rows].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventory-overview-${Date.now()}.csv"`,
      },
    });
  } catch (err: any) {
    return new Response("Export failed: " + err.message, { status: 500 });
  }
}
