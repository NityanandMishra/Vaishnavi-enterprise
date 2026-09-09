"use client";

import React from "react";
import StockOverview from "./inventory/StockOverview";

export type { InventoryItemDTO as VariantInventoryItem } from "@/lib/inventory/types";

/**
 * Legacy InventoryManager re-exporting the new EPIC-04 StockOverview component.
 */
export default function InventoryManager(props: any) {
  if (props.initialData) {
    return <StockOverview initialData={props.initialData} />;
  }

  // Backward compatibility fallback for legacy inventory array
  const legacyItems = (props.inventory || []).map((v: any) => ({
    id: v.id,
    variantId: v.id,
    productId: v.productId,
    productTitle: v.productTitle || "Product",
    variantTitle: v.title || null,
    sku: v.sku || null,
    categoryName: v.categoryName || "General",
    brandName: null,
    imageUrl: null,
    onHand: v.stock || 0,
    reserved: 0,
    available: v.stock || 0,
    lowStockThreshold: 5,
    backorderEnabled: false,
    stockStatus: (v.stock || 0) === 0 ? "OUT_OF_STOCK" : (v.stock || 0) <= 5 ? "LOW_STOCK" : "IN_STOCK",
    lastCountedAt: null,
    updatedAt: new Date(),
    activeAlert: null,
    reservedOrdersCount: 0,
  }));

  const totalOnHand = legacyItems.reduce((s: number, i: any) => s + i.onHand, 0);

  return (
    <StockOverview
      initialData={{
        items: legacyItems,
        stats: {
          totalVariants: legacyItems.length,
          totalOnHand,
          totalReserved: 0,
          totalAvailable: totalOnHand,
          lowStockCount: legacyItems.filter((i: any) => i.stockStatus === "LOW_STOCK").length,
          outOfStockCount: legacyItems.filter((i: any) => i.stockStatus === "OUT_OF_STOCK").length,
          alertMessage: null,
        },
        categories: [],
        brands: [],
        orderMap: {},
      }}
    />
  );
}
