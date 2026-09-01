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

import VariantMatrixBuilder, {
  VariantMatrixItem,
} from "@/components/admin/products/VariantMatrixBuilder";
import { cn } from "@/lib/utils";
import { productInputSchema, formatZodErrors } from "@/lib/validations/product";

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

  // Variant Matrix & Single SKU
  const [matrixVariants, setMatrixVariants] = useState<VariantMatrixItem[]>([]);
  const [singleSku, setSingleSku] = useState("");

  // Feedback states
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    if (fieldErrors.images) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.images;
        return next;
      });
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

  const formatFieldLabel = (key: string) => {
    if (key.startsWith("variants.")) {
      const parts = key.split(".");
      const idx = Number(parts[1]) + 1;
      const field = parts[2] || "";
      return `Variant #${idx} ${field ? `(${field.toUpperCase()})` : ""}`;
    }
    const map: Record<string, string> = {
      title: "Product Title",
      description: "Description",
      basePrice: "Base Price",
      categoryId: "Category",
      images: "Product Images",
      variants: "Variants & SKUs",
      checkoutMode: "Checkout Mode",
      stockMode: "Stock Mode",
    };
    return map[key] || key;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const specsMap: Record<string, string> = {};
    specs.forEach((s) => {
      if (s.key.trim() && s.value.trim()) {
        specsMap[s.key.trim()] = s.value.trim();
      }
    });

    const payload = {
      title,
      description,
      basePrice: basePrice ? Number(basePrice) : 0,
      categoryId,
      brandId: brandId || null,
      checkoutMode,
      stockMode,
      isAvailable,
      specs: specsMap,
      images: selectedImages.map((si, idx) => ({
        imageId: si.imageId,
        sortOrder: idx,
        isMain: si.isMain,
      })),
      variants:
        matrixVariants.length > 0
          ? matrixVariants.map((v) => ({
              title: v.title.trim() || "Standard",
              sku: v.sku?.trim() || "",
              price: v.price ? Number(v.price) : Number(basePrice || 0),
              mrp: v.mrp ? Number(v.mrp) : null,
              stock: stockMode === "TRACKED" ? Number(v.stock || 0) : 0,
              isActive: v.isActive,
              isAvailable: isAvailable && v.isActive,
              attributeValues: v.combination.map((c) => ({
                attributeId: c.attributeId,
                attributeValueId: c.attributeValueId,
              })),
            }))
          : [
              {
                title: "Standard",
                sku: singleSku.trim() || "",
                price: Number(basePrice || 0),
                mrp: null,
                stock: stockMode === "TRACKED" ? 10 : 0,
                isActive: true,
                isAvailable: isAvailable,
              },
            ],
    };

    // Client-side Zod Validation
    const parsed = productInputSchema.safeParse(payload);
    if (!parsed.success) {
      const errMap = formatZodErrors(parsed.error);
      setFieldErrors(errMap);
      setError(parsed.error.issues[0]?.message || "Please resolve the highlighted validation errors.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);

    const res = await createProduct(payload as any);
    if (res.success) {
      router.push("/admin/products");
    } else {
      setError(res.error || "Failed to create product");
      if ((res as any).fieldErrors) {
        setFieldErrors((res as any).fieldErrors);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
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

      {/* Validation Error Summary Banner */}
      {Object.keys(fieldErrors).length > 0 && (
        <div className="bg-rose-50/95 border border-rose-300 text-rose-900 px-5 py-4 rounded-lg shadow-sm space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>
              Please resolve the following {Object.keys(fieldErrors).length} error
              {Object.keys(fieldErrors).length === 1 ? "" : "s"} before saving:
            </span>
          </div>
          <ul className="list-disc list-inside text-xs space-y-1 text-rose-700 ml-1">
            {Object.entries(fieldErrors).map(([key, msg]) => (
              <li key={key}>
                <span className="font-semibold">{formatFieldLabel(key)}:</span> {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && Object.keys(fieldErrors).length === 0 && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-[6px] flex items-center gap-2">
          <AlertCircle size={18} />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      <form noValidate onSubmit={handleSave} className="space-y-6">
        {/* ── Section 1: General Info ─────────────────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3">
            General Information
          </h3>

          <div className="space-y-1">
            <label className="text-xs text-[#475569] font-bold">
              Product Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (fieldErrors.title) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.title;
                    return next;
                  });
                }
              }}
              placeholder="e.g. Finolex 2.5 sqmm FR insulated copper wire"
              className={cn(
                "w-full bg-white border rounded-[6px] px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:ring-0",
                fieldErrors.title
                  ? "border-rose-500 bg-rose-50/20 focus:border-rose-500"
                  : "border-[#cbd5e1] focus:border-[#EA580C]"
              )}
            />
            {fieldErrors.title && (
              <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 mt-1 animate-in fade-in">
                <AlertCircle size={13} className="shrink-0" />
                {fieldErrors.title}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#475569] font-bold">
              Description <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (fieldErrors.description) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.description;
                    return next;
                  });
                }
              }}
              placeholder="Provide a detailed product description (minimum 10 characters)..."
              rows={4}
              className={cn(
                "w-full bg-white border rounded-[6px] px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:ring-0",
                fieldErrors.description
                  ? "border-rose-500 bg-rose-50/20 focus:border-rose-500"
                  : "border-[#cbd5e1] focus:border-[#EA580C]"
              )}
            />
            {fieldErrors.description && (
              <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 mt-1 animate-in fade-in">
                <AlertCircle size={13} className="shrink-0" />
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-[#475569] font-bold">
                Base Price (INR) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                value={basePrice}
                onChange={(e) => {
                  setBasePrice(e.target.value);
                  if (fieldErrors.basePrice) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.basePrice;
                      return next;
                    });
                  }
                }}
                placeholder="2200"
                className={cn(
                  "w-full bg-white border rounded-[6px] px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none font-mono",
                  fieldErrors.basePrice
                    ? "border-rose-500 bg-rose-50/20 focus:border-rose-500"
                    : "border-[#cbd5e1] focus:border-[#EA580C]"
                )}
              />
              {fieldErrors.basePrice && (
                <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 mt-1 animate-in fade-in">
                  <AlertCircle size={13} className="shrink-0" />
                  {fieldErrors.basePrice}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#475569] font-bold">
                Category <span className="text-rose-600">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  if (fieldErrors.categoryId) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.categoryId;
                      return next;
                    });
                  }
                }}
                className={cn(
                  "w-full bg-white border rounded-[6px] px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none",
                  fieldErrors.categoryId
                    ? "border-rose-500 bg-rose-50/20 focus:border-rose-500"
                    : "border-[#cbd5e1] focus:border-[#EA580C]"
                )}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fieldErrors.categoryId && (
                <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 mt-1 animate-in fade-in">
                  <AlertCircle size={13} className="shrink-0" />
                  {fieldErrors.categoryId}
                </p>
              )}
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
                    placeholder="e.g. Warranty"
                    value={s.key}
                    onChange={(e) => handleSpecChange(idx, "key", e.target.value)}
                    className="flex-1 bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
                  />
                  <input
                    type="text"
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
            <div>
              <h3 className="font-sans font-bold text-[#0F172A] text-base">
                Product Images <span className="text-rose-600">*</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Select high-resolution images. Mark one as the main hero photo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowImagePicker(!showImagePicker)}
              className="py-1.5 px-3 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#EA580C]/40 text-xs font-bold text-[#475569] hover:text-[#0F172A] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={12} />
              {showImagePicker ? "Hide Picker" : "Select from Media Library"}
            </button>
          </div>

          {fieldErrors.images && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-[6px] text-xs text-rose-800 font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{fieldErrors.images}</span>
            </div>
          )}

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

        {/* ── Section 4: Variant Matrix & SKUs ───────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <div className="border-b border-[#E2E8F0] pb-3">
            <h3 className="font-sans font-bold text-[#0F172A] text-base">
              Product Variants & SKUs <span className="text-rose-600">*</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Build and configure variant combinations, individual pricing, and unique SKU identifiers.
            </p>
          </div>

          {fieldErrors.variants && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-[6px] text-xs text-rose-800 font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{fieldErrors.variants}</span>
            </div>
          )}

          <VariantMatrixBuilder
            categoryId={categoryId}
            categoryName={categories.find((c) => c.id === categoryId)?.name}
            brandSlug={brands.find((b) => b.id === brandId)?.name || "VE"}
            categorySlug={categories.find((c) => c.id === categoryId)?.name || "CAT"}
            productTitle={title}
            basePrice={Number(basePrice) || 0}
            variants={matrixVariants}
            onChange={(vars) => {
              setMatrixVariants(vars);
              if (fieldErrors.variants) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.variants;
                  return next;
                });
              }
            }}
            singleSku={singleSku}
            onSingleSkuChange={(sku) => {
              setSingleSku(sku);
              if (fieldErrors.variants) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.variants;
                  return next;
                });
              }
            }}
          />
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
