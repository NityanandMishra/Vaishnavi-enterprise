"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  X,
  Edit,
  Copy,
  Power,
  Package,
  Tag,
  FileText,
  Truck,
  ChevronRight,
  ChevronLeft,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import Drawer from "@/components/admin/ui/Drawer";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { formatINR } from "@/lib/utils";
import { toast } from "@/components/admin/ui/Toast";
import { updateProductStatus, duplicateProduct } from "@/app/admin/(authenticated)/products/actions";

export interface QuickViewProduct {
  id: string;
  title: string;
  slug?: string | null;
  status: string;
  basePrice: number;
  unit?: string | null;
  hsnCode?: string | null;
  category?: { id: string; name: string; slug: string; hsnCode?: string | null };
  brand?: { id: string; name: string; slug: string } | null;
  variants: Array<{
    id: string;
    title: string;
    sku: string | null;
    price: number | null;
    mrp: number | null;
    stock: number;
    isActive: boolean;
  }>;
  images: Array<{
    image: { url: string; alt?: string | null; filename: string };
  }>;
}

interface ProductQuickViewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product: QuickViewProduct | null;
  allProducts: QuickViewProduct[];
  onNavigateProduct?: (nextProduct: QuickViewProduct) => void;
  onRefresh?: () => void;
}

export default function ProductQuickViewDrawer({
  isOpen,
  onClose,
  product,
  allProducts,
  onNavigateProduct,
  onRefresh,
}: ProductQuickViewDrawerProps) {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Reset selected image when product changes
  useEffect(() => {
    setSelectedImageIdx(0);
  }, [product?.id]);

  // ─── KEYBOARD J / K NAVIGATION (PROD-13) ─────────────────────────────────
  useEffect(() => {
    if (!isOpen || !product || allProducts.length <= 1) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is typing inside an input/textarea
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const currentIndex = allProducts.findIndex((p) => p.id === product?.id);
      if (currentIndex === -1) return;

      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % allProducts.length;
        onNavigateProduct?.(allProducts[nextIndex]);
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + allProducts.length) % allProducts.length;
        onNavigateProduct?.(allProducts[prevIndex]);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, product, allProducts, onNavigateProduct]);

  if (!product) return null;

  // Compute pricing range
  const activeVariants = product.variants.filter((v) => v.isActive !== false);
  const prices = activeVariants.map((v) => Number(v.price) || 0).filter((p) => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : product.basePrice;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : product.basePrice;
  const priceDisplay =
    minPrice === maxPrice
      ? formatINR(minPrice)
      : `${formatINR(minPrice)} – ${formatINR(maxPrice)}`;

  // Compute stock state
  const totalStock = activeVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  const outOfStockCount = activeVariants.filter((v) => (Number(v.stock) || 0) === 0).length;

  const handleToggleActive = async () => {
    setIsActionLoading(true);
    try {
      const target = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const res = await updateProductStatus(product.id, target);
      if (res.success) {
        toast.success(
          `Product ${target === "ACTIVE" ? "Activated" : "Deactivated"}`,
          `${product.title} is now ${target.toLowerCase()}`
        );
        onRefresh?.();
      } else {
        toast.error("Status Update Failed", res.error || "Could not change status");
      }
    } catch (err: any) {
      toast.error("Error", err.message || "Failed to update status");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    setIsActionLoading(true);
    try {
      const res = await duplicateProduct(product.id);
      if (res.success) {
        toast.success("Product Duplicated", `Created copy of ${product.title}`);
        onRefresh?.();
      } else {
        toast.error("Duplicate Failed", res.error || "Failed to duplicate");
      }
    } catch (err: any) {
      toast.error("Error", err.message || "Could not duplicate product");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Product Quick View" width="wide">
      <div className="space-y-6 pb-6">
        {/* Top Header Card */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--color-border-subtle)]">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-[var(--color-fg-muted)]">
              {product.category?.name || "General"}
              {product.brand && ` · ${product.brand.name}`}
            </span>
            <h2 className="text-[var(--text-lg)] font-bold text-[var(--color-fg)] leading-snug">
              {product.title}
            </h2>
            <div className="flex items-center gap-2 pt-1">
              <StatusBadge status={product.status} />
              <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">
                {product.variants.length} SKU{product.variants.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Keyboard tip */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[10px] text-[var(--color-fg-muted)]">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 bg-[var(--color-surface)] rounded border font-mono font-bold">J</kbd>
            <span>/</span>
            <kbd className="px-1.5 py-0.5 bg-[var(--color-surface)] rounded border font-mono font-bold">K</kbd>
            <span>to flip</span>
          </div>
        </div>

        {/* Media Gallery Strip */}
        {product.images.length > 0 && (
          <div className="space-y-3">
            <div className="relative aspect-video w-full rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-surface-sunken)] border border-[var(--color-border)]">
              <Image
                src={product.images[selectedImageIdx]?.image?.url || product.images[0]?.image?.url}
                alt={product.images[selectedImageIdx]?.image?.alt || product.title}
                fill
                className="object-contain p-2"
                sizes="(max-width: 768px) 100vw, 600px"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`relative w-14 h-14 rounded-md overflow-hidden border-2 flex-shrink-0 transition-all ${
                      selectedImageIdx === idx
                        ? "border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]"
                        : "border-[var(--color-border)] opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={img.image.url}
                      alt={img.image.alt || `Photo ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Price & Stock Overview Banner */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)]">
          <div>
            <span className="text-[11px] text-[var(--color-fg-muted)] block">Price Range</span>
            <strong className="text-[var(--text-lg)] font-bold text-[var(--color-fg)] font-mono">
              {priceDisplay}
            </strong>
          </div>
          <div>
            <span className="text-[11px] text-[var(--color-fg-muted)] block">Stock Health</span>
            <div className="flex items-center gap-1.5 pt-0.5">
              <strong
                className={`text-[var(--text-sm)] font-bold font-mono ${
                  totalStock === 0
                    ? "text-[var(--color-danger)]"
                    : totalStock <= 10
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-success)]"
                }`}
              >
                {totalStock} units in stock
              </strong>
            </div>
            {outOfStockCount > 0 && product.variants.length > 1 && (
              <span className="text-[10px] text-[var(--color-warning)] block mt-0.5">
                {outOfStockCount} of {product.variants.length} variants out of stock
              </span>
            )}
          </div>
        </div>

        {/* Variants Breakdown Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-xs)] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
              Variant Breakdown ({product.variants.length})
            </span>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-left text-[var(--text-xs)] border-collapse">
              <thead className="bg-[var(--color-surface-sunken)] text-[var(--color-fg-muted)] font-semibold border-b border-[var(--color-border)] sticky top-0">
                <tr>
                  <th className="p-2.5">Variant</th>
                  <th className="p-2.5">SKU</th>
                  <th className="p-2.5 text-right">Price</th>
                  <th className="p-2.5 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)] bg-[var(--color-surface)]">
                {product.variants.map((v) => (
                  <tr key={v.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="p-2.5 font-medium text-[var(--color-fg)]">{v.title}</td>
                    <td className="p-2.5 font-mono text-[11px] text-[var(--color-fg-muted)]">
                      {v.sku || "—"}
                    </td>
                    <td className="p-2.5 text-right font-mono font-medium">
                      {v.price ? formatINR(v.price) : "—"}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      <span
                        className={
                          v.stock === 0
                            ? "text-[var(--color-danger)] font-bold"
                            : v.stock <= 5
                            ? "text-[var(--color-warning)] font-bold"
                            : "text-[var(--color-fg)]"
                        }
                      >
                        {v.stock}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Technical Details Key-Values */}
        <div className="space-y-2">
          <span className="text-[var(--text-xs)] font-bold uppercase tracking-wider text-[var(--color-fg-muted)] block">
            Product Attributes & Tax
          </span>
          <dl className="grid grid-cols-2 gap-2 text-[var(--text-xs)]">
            <div className="p-2.5 rounded bg-[var(--color-surface-sunken)]">
              <dt className="text-[var(--color-fg-muted)] text-[10px]">Unit</dt>
              <dd className="font-semibold text-[var(--color-fg)] mt-0.5">
                {product.unit || "Piece"}
              </dd>
            </div>
            <div className="p-2.5 rounded bg-[var(--color-surface-sunken)]">
              <dt className="text-[var(--color-fg-muted)] text-[10px]">HSN Tax Code</dt>
              <dd className="font-mono font-semibold text-[var(--color-fg)] mt-0.5">
                {product.hsnCode || product.category?.hsnCode || "8541"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Drawer Action Bar */}
        <div className="pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={isActionLoading}
              className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--text-xs)] font-medium flex items-center gap-1.5 transition-colors"
            >
              <Copy size={13} /> Duplicate
            </button>
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={isActionLoading}
              className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--text-xs)] font-medium flex items-center gap-1.5 transition-colors"
            >
              <Power size={13} />
              {product.status === "ACTIVE" ? "Deactivate" : "Activate"}
            </button>
          </div>

          <Link
            href={`/admin/products/${product.id}/edit`}
            className="h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[var(--text-xs)] font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Edit size={13} /> Edit Full Product
          </Link>
        </div>
      </div>
    </Drawer>
  );
}
