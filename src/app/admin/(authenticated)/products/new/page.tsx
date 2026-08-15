"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getFormMetadata, createProduct } from "../actions";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Image as ImageIcon,
  Check,
  Star,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface MediaImage {
  id: string;
  url: string;
  filename: string;
  alt: string | null;
}

interface SpecRow {
  key: string;
  value: string;
}

interface VariantRow {
  title: string;
  sku: string;
  price: string;
  stock: number;
  color: string;
  size: string;
  isAvailable: boolean;
}

interface SelectedImage {
  imageId: string;
  sortOrder: number;
  isMain: boolean;
  url: string;
}

export default function NewProductPage() {
  const router = useRouter();

  // Metadata states
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [images, setImages] = useState<MediaImage[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [checkoutMode, setCheckoutMode] = useState("BUY");
  const [stockMode, setStockMode] = useState("TRACKED");
  const [isAvailable, setIsAvailable] = useState(true);

  // Specifications
  const [specs, setSpecs] = useState<SpecRow[]>([
    { key: "Warranty", value: "1 Year" },
  ]);

  // Selected Images
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);

  // Variants
  const [variants, setVariants] = useState<VariantRow[]>([
    {
      title: "Standard",
      sku: "",
      price: "",
      stock: 10,
      color: "",
      size: "",
      isAvailable: true,
    },
  ]);

  // Feedback states
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    setLoadingMeta(true);
    const res = await getFormMetadata();
    if (res.success) {
      setCategories(res.categories || []);
      setBrands(res.brands || []);
      setImages(res.images || []);

      if (res.categories && res.categories.length > 0) {
        setCategoryId(res.categories[0].id);
      }
    } else {
      setError(res.error || "Failed to load metadata config options");
    }
    setLoadingMeta(false);
  };

  const handleAddSpec = () => {
    setSpecs([...specs, { key: "", value: "" }]);
  };

  const handleRemoveSpec = (index: number) => {
    setSpecs(specs.filter((_, idx) => idx !== index));
  };

  const handleSpecChange = (index: number, field: "key" | "value", val: string) => {
    setSpecs(
      specs.map((s, idx) => (idx === index ? { ...s, [field]: val } : s))
    );
  };

  const handleToggleImage = (img: MediaImage) => {
    const exists = selectedImages.some((si) => si.imageId === img.id);
    if (exists) {
      setSelectedImages(selectedImages.filter((si) => si.imageId !== img.id));
    } else {
      const newImg: SelectedImage = {
        imageId: img.id,
        sortOrder: selectedImages.length,
        isMain: selectedImages.length === 0, // Make main if first image
        url: img.url,
      };
      setSelectedImages([...selectedImages, newImg]);
    }
  };

  const handleSetMainImage = (imageId: string) => {
    setSelectedImages(
      selectedImages.map((si) => ({
        ...si,
        isMain: si.imageId === imageId,
      }))
    );
  };

  const handleAddVariant = () => {
    setVariants([
      ...variants,
      {
        title: "",
        sku: "",
        price: "",
        stock: 10,
        color: "",
        size: "",
        isAvailable: true,
      },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants(variants.filter((_, idx) => idx !== index));
  };

  const handleVariantChange = (index: number, field: keyof VariantRow, val: any) => {
    setVariants(
      variants.map((v, idx) => (idx === index ? { ...v, [field]: val } : v))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!categoryId) {
      setError("Please select a category");
      return;
    }

    if (selectedImages.length === 0) {
      setError("Please add at least one product image");
      return;
    }

    setSubmitting(true);

    const payload = {
      title,
      description,
      basePrice: Number(basePrice),
      categoryId,
      brandId: brandId || null,
      checkoutMode,
      stockMode,
      isAvailable,
      specs: specs.filter((s) => s.key.trim() && s.value.trim()),
      images: selectedImages.map((si) => ({
        imageId: si.imageId,
        sortOrder: si.sortOrder,
        isMain: si.isMain,
      })),
      variants: variants.map((v) => ({
        title: v.title || "Standard",
        sku: v.sku || null,
        price: v.price ? Number(v.price) : null,
        stock: stockMode === "TRACKED" ? Number(v.stock) : 0,
        color: v.color || null,
        size: v.size || null,
        isAvailable: v.isAvailable,
      })),
    };

    const res = await createProduct(payload as any);
    if (res.success) {
      router.push("/admin/products");
    } else {
      setError(res.error || "Failed to create product");
      setSubmitting(false);
    }
  };

  if (loadingMeta) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-2">
        <Loader2 size={32} className="animate-spin text-[#EA580C]" />
        <span>Loading product configuration...</span>
      </div>
    );
  }

  return (
    <div className="font-sans space-y-6 max-w-5xl mx-auto">
      {/* Header Back Link */}
      <div className="flex items-center gap-4 mb-4">
        <Link
          href="/admin/products"
          className="p-2 rounded-[4px] bg-white border border-[#E2E8F0] text-[#475569] hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-[6px] flex items-center gap-2">
          <AlertCircle size={18} />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ── Section 1: General Info ─────────────────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3">
            General Information
          </h3>

          <div className="space-y-1">
            <label className="text-xs text-[#475569] font-bold">Product Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Finolex 2.5 sqmm FR insulated copper wire"
              className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C] focus:ring-0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#475569] font-bold">Description</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a detailed product description..."
              rows={4}
              className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C] focus:ring-0"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-[#475569] font-bold">Base Price (INR)</label>
              <input
                type="number"
                required
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="2200"
                className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C] font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#475569] font-bold">Category</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#475569] font-bold">Brand (Optional)</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
              >
                <option value="">Generic / No Brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs text-[#475569] font-bold">Checkout Flow</label>
              <select
                value={checkoutMode}
                onChange={(e) => setCheckoutMode(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
              >
                <option value="BUY">BUY (Add to cart & online pay)</option>
                <option value="INQUIRE">INQUIRE (Customer callback request)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#475569] font-bold">Stock Mode</label>
              <select
                value={stockMode}
                onChange={(e) => setStockMode(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
              >
                <option value="TRACKED">TRACKED (Requires variant stock counts)</option>
                <option value="VIRTUAL">VIRTUAL (Unlimited stock)</option>
                <option value="INQUIRE">INQUIRE (No stock level, request only)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 h-full pt-6">
              <input
                type="checkbox"
                id="isAvailable"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="rounded border-[#cbd5e1] text-[#EA580C] focus:ring-[#EA580C] w-4 h-4 bg-white cursor-pointer"
              />
              <label htmlFor="isAvailable" className="text-sm text-[#475569] font-bold cursor-pointer">
                Publish immediately (Visible in catalog)
              </label>
            </div>
          </div>
        </div>

        {/* ── Section 2: Specifications Builder ─────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
            <h3 className="font-sans font-bold text-[#0F172A] text-base">
              Product Specifications
            </h3>
            <button
              type="button"
              onClick={handleAddSpec}
              className="py-1.5 px-3 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#EA580C]/40 text-xs font-bold text-[#475569] hover:text-[#0F172A] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={12} />
              Add Specification
            </button>
          </div>

          {specs.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              No specifications defined. Click "Add Specification" to build technical property fields.
            </p>
          ) : (
            <div className="space-y-3">
              {specs.map((s, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Warranty"
                    value={s.key}
                    onChange={(e) => handleSpecChange(idx, "key", e.target.value)}
                    className="flex-1 bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
                  />
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2 Years"
                    value={s.value}
                    onChange={(e) => handleSpecChange(idx, "value", e.target.value)}
                    className="flex-1 bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSpec(idx)}
                    className="p-2 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition-all flex-shrink-0 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 3: Media References ────────────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
            <h3 className="font-sans font-bold text-[#0F172A] text-base">
              Product Images
            </h3>
            <button
              type="button"
              onClick={() => setShowImagePicker(!showImagePicker)}
              className="py-1.5 px-3 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#EA580C]/40 text-xs font-bold text-[#475569] hover:text-[#0F172A] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={12} />
              {showImagePicker ? "Hide Picker" : "Select from Media Library"}
            </button>
          </div>

          {/* Selected Images Grid */}
          {selectedImages.length === 0 ? (
            <div className="border border-dashed border-[#E2E8F0] bg-[#F8FAFC] rounded-[6px] p-8 text-center text-slate-400">
              <ImageIcon size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-[#0F172A]">No images selected</p>
              <p className="text-[10px] text-slate-500 mt-1">Click the select button to tie existing library images.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
              {selectedImages.map((si) => (
                <div
                  key={si.imageId}
                  className={`relative aspect-square rounded-[6px] overflow-hidden bg-white border flex items-center justify-center p-1 group ${
                    si.isMain ? "border-[#EA580C] ring-1 ring-[#EA580C]" : "border-[#E2E8F0]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={si.url} alt="Product image preview" className="object-contain w-full h-full" />
                  
                  {/* Hover Controls */}
                  <div className="absolute inset-0 bg-[#0F172A]/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSetMainImage(si.imageId)}
                      className={`p-1.5 rounded-[4px] border transition-colors ${
                        si.isMain
                          ? "bg-[#EA580C]/20 border-[#EA580C]/40 text-[#EA580C]"
                          : "bg-white border-[#E2E8F0] text-[#475569] hover:text-[#0F172A]"
                      }`}
                      title="Set as main/hero image"
                    >
                      <Star size={12} fill={si.isMain ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleImage({ id: si.imageId, url: si.url } as any)}
                      className="p-1.5 rounded-[4px] bg-rose-600 border border-rose-700 text-white hover:bg-rose-700 transition-colors"
                      title="Remove image"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {si.isMain && (
                    <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-[#EA580C] text-white px-1 py-0.2 rounded font-mono uppercase tracking-wider">
                      Main
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Media Library Picker panel */}
          {showImagePicker && (
            <div className="border border-[#E2E8F0] bg-[#F8FAFC] rounded-[6px] p-4 space-y-3">
              <p className="text-xs font-bold text-[#0F172A]">Choose images from your library:</p>
              {images.length === 0 ? (
                <p className="text-center py-4 text-xs text-slate-500">
                  No images in library. Go to <Link href="/admin/images" className="text-[#EA580C] font-semibold hover:underline">Media Library</Link> to upload them.
                </p>
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {images.map((img) => {
                    const isSelected = selectedImages.some((si) => si.imageId === img.id);
                    return (
                      <div
                        key={img.id}
                        onClick={() => handleToggleImage(img)}
                        className={`relative aspect-square bg-white border rounded-[6px] overflow-hidden flex items-center justify-center p-1 cursor-pointer transition-colors ${
                          isSelected
                            ? "border-[#EA580C] ring-1 ring-[#EA580C]"
                            : "border-[#E2E8F0] hover:border-slate-400"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={img.alt || img.filename}
                          className="object-contain w-full h-full"
                        />
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-[#EA580C] text-white rounded-full p-0.5">
                            <Check size={8} strokeWidth={4} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Section 4: Variant Manager ──────────────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
            <h3 className="font-sans font-bold text-[#0F172A] text-base">
              Product Variants
            </h3>
            <button
              type="button"
              onClick={handleAddVariant}
              className="py-1.5 px-3 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#EA580C]/40 text-xs font-bold text-[#475569] hover:text-[#0F172A] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={12} />
              Add Variant
            </button>
          </div>

          <div className="space-y-4 divide-y divide-[#E2E8F0]">
            {variants.map((v, idx) => (
              <div key={idx} className={`pt-4 ${idx === 0 ? "pt-0" : ""} space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#475569]">Variant #{idx + 1}</span>
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(idx)}
                      className="text-xs text-rose-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={11} />
                      Remove Variant
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#475569] font-bold">Variant Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Classy White / 1200mm"
                      value={v.title}
                      onChange={(e) => handleVariantChange(idx, "title", e.target.value)}
                      className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-1.5 text-xs text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#475569] font-bold">SKU (Unique Identifier)</label>
                    <input
                      type="text"
                      placeholder="e.g. ORN-BLDC-1200-WHT"
                      value={v.sku}
                      onChange={(e) => handleVariantChange(idx, "sku", e.target.value)}
                      className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-1.5 text-xs text-[#0f172a] focus:outline-none focus:border-[#EA580C] font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#475569] font-bold">
                      Price Override (INR, optional)
                    </label>
                    <input
                      type="number"
                      placeholder="Leave blank to inherit product base price"
                      value={v.price}
                      onChange={(e) => handleVariantChange(idx, "price", e.target.value)}
                      className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-1.5 text-xs text-[#0f172a] focus:outline-none focus:border-[#EA580C] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#475569] font-bold">Stock Count</label>
                    <input
                      type="number"
                      required
                      disabled={stockMode !== "TRACKED"}
                      value={v.stock}
                      onChange={(e) => handleVariantChange(idx, "stock", Number(e.target.value))}
                      className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-1.5 text-xs text-[#0f172a] focus:outline-none focus:border-[#EA580C] font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#475569] font-bold">Color (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. White"
                      value={v.color}
                      onChange={(e) => handleVariantChange(idx, "color", e.target.value)}
                      className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-1.5 text-xs text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#475569] font-bold">Size (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 1200mm"
                      value={v.size}
                      onChange={(e) => handleVariantChange(idx, "size", e.target.value)}
                      className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-1.5 text-xs text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 pt-5 pl-2">
                    <input
                      type="checkbox"
                      id={`var-active-${idx}`}
                      checked={v.isAvailable}
                      onChange={(e) => handleVariantChange(idx, "isAvailable", e.target.checked)}
                      className="rounded border-[#cbd5e1] text-[#EA580C] focus:ring-[#EA580C] w-3.5 h-3.5 bg-white cursor-pointer"
                    />
                    <label
                      htmlFor={`var-active-${idx}`}
                      className="text-[11px] text-[#475569] font-semibold cursor-pointer"
                    >
                      Variant Active
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex gap-4">
          <Link
            href="/admin/products"
            className="flex-1 bg-white border border-[#cbd5e1] hover:border-slate-400 text-[#475569] font-semibold py-3 px-4 rounded-[4px] text-sm transition-colors text-center cursor-pointer"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold py-3 px-4 rounded-[4px] text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Publishing...
              </>
            ) : (
              "Publish Product"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
