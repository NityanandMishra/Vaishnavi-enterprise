"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Package,
  Edit,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
  Eye,
  Power,
  Copy,
  Download,
  Upload,
  Filter,
  MoreVertical,
  CheckSquare,
  Square,
  Sparkles,
  Sliders,
  DollarSign,
  Bookmark,
  ChevronDown,
  X,
  RotateCcw,
  Archive,
  RefreshCw,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import Modal from "@/components/admin/ui/Modal";
import { toast } from "@/components/admin/ui/Toast";
import ProductQuickViewDrawer, { QuickViewProduct } from "@/components/admin/products/ProductQuickViewDrawer";
import BulkPriceAdjustModal from "@/components/admin/products/BulkPriceAdjustModal";
import {
  getProducts,
  getFormMetadata,
  updateProductStatus,
  duplicateProduct,
  bulkUpdateStatus,
  bulkChangeCategory,
  deleteProduct,
  getSavedViews,
  saveProductView,
  deleteSavedView,
} from "./actions";

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── DATA STATE ──────────────────────────────────────────────────────────
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({
    all: 0,
    active: 0,
    draft: 0,
    inactive: 0,
    archived: 0,
  });

  // ─── FILTERS STATE ───────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<"ALL" | "ACTIVE" | "DRAFT" | "INACTIVE" | "ARCHIVED">("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedBrand, setSelectedBrand] = useState("ALL");
  const [selectedStock, setSelectedStock] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");

  // Selection state for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Drawers state
  const [quickViewProduct, setQuickViewProduct] = useState<QuickViewProduct | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [isPriceAdjustModalOpen, setIsPriceAdjustModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [bulkTargetCategory, setBulkTargetCategory] = useState("");

  // Saved Views
  const [savedViews, setSavedViews] = useState<Array<{ id: string; name: string; filters: string }>>([]);
  const [isSavedViewModalOpen, setIsSavedViewModalOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [isSavedViewsDropdownOpen, setIsSavedViewsDropdownOpen] = useState(false);

  // Single item action dialogs
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ─── INITIAL LOAD ────────────────────────────────────────────────────────
  useEffect(() => {
    loadMetadata();
    loadSavedViews();
  }, []);

  const loadMetadata = async () => {
    const meta = await getFormMetadata();
    if (meta.success) {
      if (meta.categories) setCategories(meta.categories);
      if (meta.brands) setBrands(meta.brands);
    }
  };

  const loadSavedViews = async () => {
    const res = await getSavedViews();
    if (res.success) {
      setSavedViews(res.views);
    }
  };

  // ─── FETCH PRODUCTS (DEBOUNCED & SERVER PAGINATED) ────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [page, searchQuery, statusTab, selectedCategory, selectedBrand, selectedStock]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await getProducts({
        page,
        limit: 20,
        search: searchQuery,
        status: statusTab,
        categoryId: selectedCategory,
        brandId: selectedBrand,
        stockState: selectedStock,
      });

      if (res.success && res.products) {
        setProducts(res.products);
        if (res.pagination) {
          setTotalCount(res.pagination.totalCount);
          setTotalPages(res.pagination.totalPages);
        }
        if (res.counts) {
          setCounts(res.counts);
        }
      }
    } catch (err: any) {
      toast.error("Error", "Failed to load product catalog");
    } finally {
      setLoading(false);
    }
  };

  // ─── SELECTION LOGIC (CROSS-PAGE PRESERVED) ──────────────────────────────
  const toggleSelectAll = () => {
    const currentPageIds = products.map((p) => p.id);
    const allSelectedOnPage = currentPageIds.every((id) => selectedIds.includes(id));

    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // ─── QUICK VIEW DRAWER NAVIGATION (J / K) ────────────────────────────────
  const handleOpenQuickView = (product: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setQuickViewProduct(product);
    setIsQuickViewOpen(true);
  };

  // ─── SINGLE ACTIONS ──────────────────────────────────────────────────────
  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await duplicateProduct(id);
      if (res.success && res.newProductId) {
        toast.success("Product Duplicated", "Created draft copy. Opening editor...");
        router.push(`/admin/products/${res.newProductId}/edit`);
      } else {
        toast.error("Duplicate Failed", res.error || "Could not duplicate product");
      }
    } catch (err) {
      toast.error("Error", "Failed to duplicate product");
    }
  };

  const handleToggleStatus = async (product: any, target: "ACTIVE" | "INACTIVE" | "ARCHIVED" | "RESTORE", e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await updateProductStatus(product.id, target);
      if (res.success) {
        toast.success(
          "Status Updated",
          target === "RESTORE" ? "Restored as Inactive" : `Status changed to ${target.toLowerCase()}`
        );
        fetchProducts();
      } else {
        toast.error("Status Update Blocked", res.error || "Could not update status");
      }
    } catch (err: any) {
      toast.error("Error", "Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      const res = await deleteProduct(confirmDeleteId);
      if (res.success) {
        toast.success("Product Deleted", "Draft product removed");
        fetchProducts();
      } else {
        toast.error("Delete Blocked", res.error || "Cannot delete this product");
      }
    } catch (err: any) {
      toast.error("Error", "Failed to delete product");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // ─── BULK ACTIONS ────────────────────────────────────────────────────────
  const handleBulkStatus = async (action: "ACTIVATE" | "DEACTIVATE" | "ARCHIVE") => {
    try {
      const res = await bulkUpdateStatus(selectedIds, action);
      if (res.success) {
        toast.success("Bulk Action Complete", res.message);
        setSelectedIds([]);
        fetchProducts();
      } else {
        toast.error("Bulk Action Failed", res.error || "Could not complete bulk update");
      }
    } catch (err: any) {
      toast.error("Error", "Failed to run bulk status update");
    }
  };

  const handleBulkCategoryChange = async () => {
    if (!bulkTargetCategory) return;
    try {
      const res = await bulkChangeCategory(selectedIds, bulkTargetCategory);
      if (res.success) {
        toast.success("Categories Updated", res.message);
        setSelectedIds([]);
        setIsCategoryModalOpen(false);
        fetchProducts();
      } else {
        toast.error("Update Failed", res.error || "Could not update category");
      }
    } catch (err: any) {
      toast.error("Error", "Failed to update category");
    }
  };

  // ─── SAVED VIEWS ACTIONS ─────────────────────────────────────────────────
  const handleSaveCurrentView = async () => {
    if (!newViewName.trim()) return;
    const filterSnapshot = {
      searchQuery,
      statusTab,
      selectedCategory,
      selectedBrand,
      selectedStock,
    };

    const res = await saveProductView(newViewName.trim(), filterSnapshot);
    if (res.success) {
      toast.success("View Saved", `Saved filter preset "${newViewName}"`);
      setNewViewName("");
      setIsSavedViewModalOpen(false);
      loadSavedViews();
    }
  };

  const handleApplySavedView = (view: any) => {
    try {
      const filters = JSON.parse(view.filters);
      setSearchQuery(filters.searchQuery || "");
      setStatusTab(filters.statusTab || "ALL");
      setSelectedCategory(filters.selectedCategory || "ALL");
      setSelectedBrand(filters.selectedBrand || "ALL");
      setSelectedStock(filters.selectedStock || "ALL");
      setPage(1);
      setIsSavedViewsDropdownOpen(false);
      toast.info("Filter Applied", `Loaded view "${view.name}"`);
    } catch (e) {
      toast.error("Error", "Failed to parse saved view");
    }
  };

  // ─── CSV EXPORT ──────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (statusTab !== "ALL") params.set("status", statusTab);
    if (selectedCategory !== "ALL") params.set("categoryId", selectedCategory);
    if (selectedBrand !== "ALL") params.set("brandId", selectedBrand);
    if (searchQuery) params.set("search", searchQuery);
    window.location.href = `/api/admin/export?${params.toString()}`;
  };

  const isAllOnPageSelected =
    products.length > 0 && products.every((p) => selectedIds.includes(p.id));

  return (
    <div className="space-y-6 pb-20">
      {/* ─── PAGE HEADER (S1) ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--color-fg)]">
            Products
          </h1>
          <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)] mt-1">
            {counts.all.toLocaleString()} products · {counts.active.toLocaleString()} active ·{" "}
            {counts.draft.toLocaleString()} drafts
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-fg)] text-[var(--text-xs)] font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>

          <Link
            href="/admin/products/import"
            className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-fg)] text-[var(--text-xs)] font-medium flex items-center gap-1.5 transition-colors"
          >
            <Upload size={14} /> Import CSV
          </Link>

          <Link
            href="/admin/products/new"
            className="h-9 px-3.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[var(--text-xs)] font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus size={15} /> Add Product
          </Link>
        </div>
      </div>

      {/* ─── STATUS TABS (LIVE COUNTS) ────────────────────────────────────── */}
      <div className="flex border-b border-[var(--color-border)] overflow-x-auto gap-1 text-[var(--text-xs)] font-medium">
        {[
          { id: "ALL", label: "All", count: counts.all },
          { id: "ACTIVE", label: "Active", count: counts.active },
          { id: "DRAFT", label: "Draft", count: counts.draft },
          { id: "INACTIVE", label: "Inactive", count: counts.inactive },
          { id: "ARCHIVED", label: "Archived", count: counts.archived },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setStatusTab(tab.id as any);
              setPage(1);
            }}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              statusTab === tab.id
                ? "border-[var(--color-primary)] text-[var(--color-primary)] font-bold"
                : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border)]"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                statusTab === tab.id
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-sunken)] text-[var(--color-fg-muted)]"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── TOOLBAR & FILTERS ────────────────────────────────────────────── */}
      <div className="bg-[var(--color-surface)] p-3.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-2.5 text-[var(--color-fg-muted)]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, SKU, or slug..."
            className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-xs)] focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 px-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--text-xs)] text-[var(--color-fg)] font-medium"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Brand Filter */}
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="h-9 px-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--text-xs)] text-[var(--color-fg)] font-medium"
          >
            <option value="ALL">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            value={selectedStock}
            onChange={(e) => setSelectedStock(e.target.value as any)}
            className="h-9 px-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--text-xs)] text-[var(--color-fg)] font-medium"
          >
            <option value="ALL">Stock: All</option>
            <option value="IN_STOCK">In Stock (&gt;10)</option>
            <option value="LOW_STOCK">Low Stock (≤10)</option>
            <option value="OUT_OF_STOCK">Out of Stock (0)</option>
          </select>

          {/* Saved Views Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSavedViewsDropdownOpen(!isSavedViewsDropdownOpen)}
              className="h-9 px-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--text-xs)] font-medium flex items-center gap-1"
            >
              <Bookmark size={13} />
              Saved views
              <ChevronDown size={13} />
            </button>

            {isSavedViewsDropdownOpen && (
              <div className="absolute right-0 top-10 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-lg py-1 z-20 text-[var(--text-xs)]">
                <button
                  type="button"
                  onClick={() => {
                    setIsSavedViewModalOpen(true);
                    setIsSavedViewsDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--color-surface-hover)] font-medium text-[var(--color-primary)] flex items-center gap-1.5"
                >
                  <Plus size={12} /> Save current view
                </button>
                <div className="border-t border-[var(--color-border-subtle)] my-1" />
                {savedViews.length === 0 ? (
                  <span className="block px-3 py-1.5 text-[var(--color-fg-muted)]">
                    No saved views
                  </span>
                ) : (
                  savedViews.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between px-3 py-1.5 hover:bg-[var(--color-surface-hover)] cursor-pointer"
                    >
                      <span onClick={() => handleApplySavedView(v)} className="flex-1 truncate">
                        {v.name}
                      </span>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await deleteSavedView(v.id);
                          loadSavedViews();
                        }}
                        className="text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── DATA TABLE (S1) ──────────────────────────────────────────────── */}
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-[var(--color-fg-muted)]">
            <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
            <span className="text-[var(--text-xs)] font-medium">Loading catalog...</span>
          </div>
        ) : products.length === 0 ? (
          /* Empty States */
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center mx-auto text-[var(--color-fg-muted)]">
              <Package size={24} />
            </div>
            {searchQuery || selectedCategory !== "ALL" || selectedBrand !== "ALL" || selectedStock !== "ALL" ? (
              <>
                <h3 className="text-[var(--text-md)] font-bold text-[var(--color-fg)]">
                  No products match these filters
                </h3>
                <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)] max-w-sm mx-auto">
                  Try adjusting search keywords or clearing active dropdown filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("ALL");
                    setSelectedBrand("ALL");
                    setSelectedStock("ALL");
                  }}
                  className="px-3.5 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-[var(--text-xs)] font-medium"
                >
                  Clear filters
                </button>
              </>
            ) : statusTab === "DRAFT" ? (
              <>
                <h3 className="text-[var(--text-md)] font-bold text-[var(--color-fg)]">
                  No drafts
                </h3>
                <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)] max-w-sm mx-auto">
                  Products you start but don't publish will appear here.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-[var(--text-md)] font-bold text-[var(--color-fg)]">
                  No products yet
                </h3>
                <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)] max-w-sm mx-auto">
                  Add your first product to start selling across Vaishnavi Enterprises storefront.
                </p>
                <Link
                  href="/admin/products/new"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[var(--text-xs)] font-bold"
                >
                  <Plus size={14} /> Add Product
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[var(--text-xs)] border-collapse">
              <thead className="bg-[var(--color-surface-sunken)] text-[var(--color-fg-muted)] border-b border-[var(--color-border)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="p-1 hover:text-[var(--color-fg)]"
                    >
                      {isAllOnPageSelected ? (
                        <CheckSquare size={16} className="text-[var(--color-primary)]" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="p-3.5 w-14">Image</th>
                  <th className="p-3.5 min-w-[220px]">Name</th>
                  <th className="p-3.5">SKU</th>
                  <th className="p-3.5">Brand</th>
                  <th className="p-3.5 text-right">Price</th>
                  <th className="p-3.5">Stock</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)] bg-[var(--color-surface)]">
                {products.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const isMulti = p.variants && p.variants.length > 1;

                  // Price calculation
                  const activeVars = (p.variants || []).filter((v: any) => v.isActive !== false);
                  const prices = activeVars.map((v: any) => Number(v.price) || 0).filter((pr: number) => pr > 0);
                  const minP = prices.length > 0 ? Math.min(...prices) : p.basePrice;
                  const maxP = prices.length > 0 ? Math.max(...prices) : p.basePrice;
                  const priceLabel =
                    minP === maxP ? formatINR(minP) : `${formatINR(minP)} – ${formatINR(maxP)}`;

                  // Stock calculation
                  const totalStock = activeVars.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
                  const oosCount = activeVars.filter((v: any) => (v.stock || 0) === 0).length;

                  // Thumbnail
                  const mainImage = p.images?.find((img: any) => img.isMain) || p.images?.[0];

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleOpenQuickView(p)}
                      className={`hover:bg-[var(--color-surface-hover)] cursor-pointer transition-colors ${
                        isSelected ? "bg-[var(--color-primary-subtle)]/40" : ""
                      }`}
                    >
                      {/* Select Checkbox */}
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => toggleSelectOne(p.id, e)}
                          className="p-1 hover:text-[var(--color-fg)]"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-[var(--color-primary)]" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* Image Thumbnail */}
                      <td className="p-3.5">
                        <div className="w-10 h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden relative bg-[var(--color-surface-sunken)] flex-shrink-0">
                          {mainImage?.image?.url ? (
                            <Image
                              src={mainImage.image.url}
                              alt={p.title}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[var(--color-fg-muted)]">
                              <Package size={16} />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Product Name & Category Breadcrumb */}
                      <td className="p-3.5">
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-[var(--color-fg)] hover:text-[var(--color-primary)] line-clamp-1"
                        >
                          {p.title}
                        </Link>
                        <span className="text-[11px] text-[var(--color-fg-muted)] line-clamp-1 mt-0.5">
                          {p.category?.name || "Uncategorized"}
                        </span>
                      </td>

                      {/* SKU */}
                      <td className="p-3.5">
                        {isMulti ? (
                          <button
                            type="button"
                            onClick={(e) => handleOpenQuickView(p, e)}
                            className="font-mono text-[11px] text-[var(--color-primary)] hover:underline font-bold"
                          >
                            {p.variants.length} SKUs
                          </button>
                        ) : (
                          <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">
                            {p.variants?.[0]?.sku || "—"}
                          </span>
                        )}
                      </td>

                      {/* Brand */}
                      <td className="p-3.5 font-medium text-[var(--color-fg-muted)]">
                        {p.brand?.name || "—"}
                      </td>

                      {/* Price */}
                      <td className="p-3.5 text-right font-mono font-bold text-[var(--color-fg)]">
                        {priceLabel}
                      </td>

                      {/* Stock Health */}
                      <td className="p-3.5">
                        {totalStock === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                            Out of stock
                          </span>
                        ) : isMulti && oosCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            {oosCount} of {p.variants.length} out
                          </span>
                        ) : totalStock <= 10 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            {totalStock} low
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800">
                            {totalStock} in stock
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <StatusBadge status={p.status} />
                      </td>

                      {/* Row Actions Menu */}
                      <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleOpenQuickView(p, e)}
                            title="Quick View (Space / Click)"
                            className="p-1 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
                          >
                            <Eye size={14} />
                          </button>
                          <Link
                            href={`/admin/products/${p.id}/edit`}
                            title="Edit Product"
                            className="p-1 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
                          >
                            <Edit size={14} />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => handleDuplicate(p.id, e)}
                            title="Duplicate Product"
                            className="p-1 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3.5 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)] flex items-center justify-between text-[var(--text-xs)]">
            <span className="text-[var(--color-fg-muted)]">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total)
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── BULK ACTION BAR (FIXED BOTTOM FLOATER) ───────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 inset-x-0 mx-auto max-w-2xl z-40 bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl rounded-[var(--radius-lg)] p-3 px-5 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[11px] font-bold">
              {selectedIds.length}
            </span>
            <span className="text-[var(--text-sm)] font-bold text-[var(--color-fg)]">
              selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[var(--text-xs)]">
            <button
              type="button"
              onClick={() => handleBulkStatus("ACTIVATE")}
              className="px-3 py-1.5 rounded-md bg-[var(--color-success)] text-white font-bold hover:opacity-90 transition-opacity"
            >
              Activate
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus("DEACTIVATE")}
              className="px-3 py-1.5 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] font-medium text-[var(--color-fg)]"
            >
              Deactivate
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus("ARCHIVE")}
              className="px-3 py-1.5 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] font-medium text-[var(--color-fg)]"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-3 py-1.5 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] font-medium text-[var(--color-fg)]"
            >
              Change category
            </button>
            <button
              type="button"
              onClick={() => setIsPriceAdjustModalOpen(true)}
              className="px-3 py-1.5 rounded-md bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] flex items-center gap-1"
            >
              <DollarSign size={13} /> Adjust price
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ─── QUICK VIEW DRAWER (S3) ───────────────────────────────────────── */}
      <ProductQuickViewDrawer
        isOpen={isQuickViewOpen}
        onClose={() => setIsQuickViewOpen(false)}
        product={quickViewProduct}
        allProducts={products}
        onNavigateProduct={(next) => setQuickViewProduct(next)}
        onRefresh={fetchProducts}
      />

      {/* ─── BULK PRICE ADJUST MODAL (S4) ─────────────────────────────────── */}
      <BulkPriceAdjustModal
        isOpen={isPriceAdjustModalOpen}
        onClose={() => setIsPriceAdjustModalOpen(false)}
        selectedProductIds={selectedIds}
        onSuccess={() => {
          setSelectedIds([]);
          fetchProducts();
        }}
      />

      {/* ─── MODAL: BULK CHANGE CATEGORY ──────────────────────────────────── */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={`Change Category for ${selectedIds.length} Products`}
        subtitle="Non-shared category attributes will be cleared from affected items."
        maxWidth="sm"
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
              Target Category
            </label>
            <select
              value={bulkTargetCategory}
              onChange={(e) => setBulkTargetCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)]"
            >
              <option value="">Select target category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="px-3 py-1.5 rounded text-[var(--text-sm)] font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!bulkTargetCategory}
              onClick={handleBulkCategoryChange}
              className="px-4 py-2 rounded bg-[var(--color-primary)] text-white text-[var(--text-sm)] font-bold disabled:opacity-50"
            >
              Apply Category Change
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: SAVE VIEW ─────────────────────────────────────────────── */}
      <Modal
        isOpen={isSavedViewModalOpen}
        onClose={() => setIsSavedViewModalOpen(false)}
        title="Save Current View"
        subtitle="Save this filter and search configuration for 1-click recall."
        maxWidth="sm"
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
              View Name
            </label>
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="e.g. Out of stock solar panels, Drafts this week"
              className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)]"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsSavedViewModalOpen(false)}
              className="px-3 py-1.5 rounded text-[var(--text-sm)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCurrentView}
              disabled={!newViewName.trim()}
              className="px-4 py-2 rounded bg-[var(--color-primary)] text-white text-[var(--text-sm)] font-bold disabled:opacity-50"
            >
              Save View
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── CONFIRM DELETE DRAFT MODAL ───────────────────────────────────── */}
      <ConfirmDialog
        isOpen={Boolean(confirmDeleteId)}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Draft Product?"
        message="This product has no order history and will be removed permanently. This action cannot be undone."
        confirmLabel="Delete Draft"
        variant="danger"
      />
    </div>
  );
}
