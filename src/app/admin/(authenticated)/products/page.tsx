"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getProducts,
  deleteProduct,
  toggleProductAvailability,
} from "./actions";
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
  EyeOff,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

interface Product {
  id: string;
  title: string;
  basePrice: number;
  checkoutMode: string;
  stockMode: string;
  isAvailable: boolean;
  categoryId: string;
  brandId: string | null;
  category: {
    name: string;
  };
  brand: {
    name: string;
  } | null;
  variants: {
    id: string;
    title: string;
    sku: string | null;
    price: number | null;
    stock: number;
    isAvailable: boolean;
  }[];
  images: {
    isMain: boolean;
    image: {
      url: string;
      filename: string;
    };
  }[];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStock, setSelectedStock] = useState<"ALL" | "INSTOCK" | "OUTOFSTOCK">("ALL");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    const res = await getProducts();
    if (res.success && res.products) {
      setProducts(res.products as any);
    } else {
      setError(res.error || "Failed to load products");
    }
    setLoading(false);
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const res = await toggleProductAvailability(id, !currentStatus);
    if (res.success) {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isAvailable: !currentStatus } : p))
      );
      setSuccessMsg("Product availability updated successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError(res.error || "Failed to update availability status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product? All its variants will be deleted too.")) return;

    setError(null);
    setSuccessMsg(null);
    const res = await deleteProduct(id);
    if (res.success) {
      setSuccessMsg("Product deleted successfully!");
      fetchProducts();
    } else {
      setError(res.error || "Failed to delete product");
    }
  };

  // Extract all categories for filtering
  const categories = Array.from(new Set(products.map((p) => p.category.name)));

  const filteredProducts = products.filter((prod) => {
    const matchesSearch =
      prod.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prod.variants.some((v) => v.sku && v.sku.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === "ALL" || prod.category.name === selectedCategory;

    const totalStock = prod.variants.reduce((acc, v) => acc + v.stock, 0);
    const matchesStock =
      selectedStock === "ALL" ||
      (selectedStock === "INSTOCK" && (totalStock > 0 || prod.stockMode === "VIRTUAL")) ||
      (selectedStock === "OUTOFSTOCK" && totalStock <= 0 && prod.stockMode === "TRACKED");

    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <div className="font-sans space-y-6">
      {/* Top action bar */}
      <div className="flex justify-end mb-4">
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white py-2.5 px-4 rounded-[4px] font-semibold text-sm cursor-pointer transition-colors"
        >
          <Plus size={16} />
          Add Product
        </Link>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-[6px] flex items-center gap-2">
          <AlertCircle size={18} />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-[6px] flex items-center gap-2">
          <Check size={18} />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Toolbar / Filters */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center gap-4 justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" />
          <input
            type="text"
            placeholder="Search products by title, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] pl-9 pr-3 py-2 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#EA580C] focus:ring-0"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-1.5 text-xs font-semibold text-[#475569] focus:outline-none focus:border-[#EA580C] cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            value={selectedStock}
            onChange={(e) => setSelectedStock(e.target.value as any)}
            className="bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-1.5 text-xs font-semibold text-[#475569] focus:outline-none focus:border-[#EA580C] cursor-pointer"
          >
            <option value="ALL">All Stock Status</option>
            <option value="INSTOCK">In Stock / Virtual</option>
            <option value="OUTOFSTOCK">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Catalog Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 size={32} className="animate-spin text-[#EA580C]" />
          <span>Loading products...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-450">
          <Package size={48} className="mx-auto text-slate-350 mb-3" />
          <p className="text-sm font-semibold text-[#0F172A]">No products found</p>
          <p className="text-xs text-slate-500 mt-1">Get started by creating your first product.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden border border-[#E2E8F0]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#475569] tracking-wider uppercase">
                  <th className="px-6 py-3.5">Product Info</th>
                  <th className="px-6 py-3.5">Category / Brand</th>
                  <th className="px-6 py-3.5">Price</th>
                  <th className="px-6 py-3.5">Inventory</th>
                  <th className="px-6 py-3.5">Checkout</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] bg-white">
                {filteredProducts.map((prod) => {
                  const mainImageObj = prod.images.find((img) => img.isMain) || prod.images[0];
                  const imageUrl = mainImageObj?.image?.url || "";
                  const totalStock = prod.variants.reduce((acc, v) => acc + v.stock, 0);
                  const skus = prod.variants
                    .map((v) => v.sku)
                    .filter(Boolean)
                    .slice(0, 2);

                  return (
                    <tr
                      key={prod.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Image + Title */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center overflow-hidden flex-shrink-0">
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imageUrl}
                                alt={prod.title}
                                className="object-contain w-full h-full p-1"
                              />
                            ) : (
                              <Package size={20} className="text-slate-350" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#0F172A] truncate max-w-xs" title={prod.title}>
                              {prod.title}
                            </p>
                            <p className="text-[10px] text-[#64748B] font-mono mt-0.5 truncate max-w-xs">
                              {skus.length > 0
                                ? `SKU: ${skus.join(", ")}${prod.variants.length > 2 ? "..." : ""}`
                                : "No SKUs"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category & Brand */}
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-[#0F172A]">
                          {prod.category.name}
                        </p>
                        <p className="text-[10px] text-[#64748B] mt-0.5 font-medium">
                          Brand: {prod.brand?.name || "Generic"}
                        </p>
                      </td>

                      {/* Base Price */}
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-[#EA580C]">
                          {formatINR(prod.basePrice)}
                        </span>
                        {prod.variants.length > 1 && (
                          <p className="text-[9px] text-[#64748B] mt-0.5">
                            {prod.variants.length} pricing tiers
                          </p>
                        )}
                      </td>

                      {/* Inventory / Stock */}
                      <td className="px-6 py-4">
                        {prod.stockMode === "TRACKED" ? (
                          <span
                            className={`text-xs font-bold ${
                              totalStock <= 0
                                ? "text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-[4px]"
                                : totalStock <= 5
                                ? "text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-[4px]"
                                : "text-[#475569]"
                            }`}
                          >
                            {totalStock <= 0 ? "Out of Stock" : `${totalStock} units`}
                          </span>
                        ) : prod.stockMode === "VIRTUAL" ? (
                          <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-[4px] border border-blue-100 font-bold">
                            Virtual (Unlimited)
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Inquire Mode</span>
                        )}
                      </td>

                      {/* Checkout Mode */}
                      <td className="px-6 py-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            prod.checkoutMode === "BUY"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                              : "bg-blue-50 text-blue-800 border-blue-100"
                          }`}
                        >
                          {prod.checkoutMode}
                        </span>
                      </td>

                      {/* Availability Status */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(prod.id, prod.isAvailable)}
                          className="focus:outline-none flex items-center cursor-pointer"
                          title="Click to toggle availability"
                        >
                          {prod.isAvailable ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                              <Eye size={10} />
                              Available
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              <EyeOff size={10} />
                              Hidden
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/products/${prod.id}/edit`}
                            className="p-1.5 rounded-[4px] border border-[#E2E8F0] hover:border-[#EA580C]/35 text-[#475569] hover:text-[#0F172A] transition-colors inline-block"
                            title="Edit Product"
                          >
                            <Edit size={14} />
                          </Link>
                          <button
                            onClick={() => handleDelete(prod.id)}
                            className="p-1.5 rounded-[4px] border border-rose-100 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
