"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Layers,
  Tag,
  Package,
  Truck,
  Search as SearchIcon,
  HelpCircle,
  X,
  Plus,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Edit3,
  Star,
  Check,
  FileText,
  Sliders,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  History,
} from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import Modal from "@/components/admin/ui/Modal";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import SearchableSelect from "@/components/admin/ui/SearchableSelect";
import MediaUploader, { UploadedMediaItem } from "@/components/admin/ui/MediaUploader";
import VariantMatrixBuilder, { VariantMatrixItem } from "@/components/admin/products/VariantMatrixBuilder";
import { toast } from "@/components/admin/ui/Toast";
import {
  saveProductDraft,
  publishProduct,
  updateProductStatus,
} from "@/app/admin/(authenticated)/products/actions";
import {
  generateSlug,
  evaluatePublishGate,
  PublishGateResult,
  PublishGateCheck,
} from "@/lib/validations/product";

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  hsnCode?: string | null;
  gstRate?: number | null;
  categoryAttributes?: Array<{
    isRequired: boolean;
    displayOrder: number;
    attribute: {
      id: string;
      name: string;
      code: string;
      inputType: string;
      values?: Array<{ id: string; label: string; code: string; swatchHex?: string | null }>;
    };
  }>;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
}

interface ProductFormProps {
  initialProduct?: any;
  categories: Category[];
  brands: Brand[];
  isEditMode?: boolean;
}

export default function ProductForm({
  initialProduct,
  categories,
  brands: initialBrands,
  isEditMode = false,
}: ProductFormProps) {
  const router = useRouter();

  // Brands list with inline creation support
  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [isNewBrandModalOpen, setIsNewBrandModalOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");

  // ─── FORM STATE ──────────────────────────────────────────────────────────
  const [id, setId] = useState<string | undefined>(initialProduct?.id);
  const [title, setTitle] = useState(initialProduct?.title || "");
  const [slug, setSlug] = useState(initialProduct?.slug || "");
  const [isSlugUserModified, setIsSlugUserModified] = useState(Boolean(initialProduct?.slug));
  const [shortDescription, setShortDescription] = useState(initialProduct?.shortDescription || "");
  const [description, setDescription] = useState(initialProduct?.description || "");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED">(
    initialProduct?.status || "DRAFT"
  );
  const [categoryId, setCategoryId] = useState(initialProduct?.categoryId || "");
  const [subCategoryId, setSubCategoryId] = useState(initialProduct?.subCategoryId || "");
  const [brandId, setBrandId] = useState(initialProduct?.brandId || "");
  const [unit, setUnit] = useState(initialProduct?.unit || "Piece");
  const [hsnCodeOverride, setHsnCodeOverride] = useState(initialProduct?.hsnCode || "");
  const [isHsnOverridden, setIsHsnOverridden] = useState(Boolean(initialProduct?.hsnCode));
  const [weightGrams, setWeightGrams] = useState<number | "">(initialProduct?.weightGrams || "");
  const [weightUnit, setWeightUnit] = useState<"g" | "kg">("g");
  const [lengthMm, setLengthMm] = useState<number | "">(initialProduct?.lengthMm || "");
  const [widthMm, setWidthMm] = useState<number | "">(initialProduct?.widthMm || "");
  const [heightMm, setHeightMm] = useState<number | "">(initialProduct?.heightMm || "");
  const [sameDimensionsForAll, setSameDimensionsForAll] = useState(true);
  const [metaTitle, setMetaTitle] = useState(initialProduct?.metaTitle || "");
  const [metaDescription, setMetaDescription] = useState(initialProduct?.metaDescription || "");
  const [version, setVersion] = useState(initialProduct?.version || 1);

  // Single-SKU vs Multi-Variant
  const [isMultiVariant, setIsMultiVariant] = useState(
    Boolean(initialProduct?.variants && initialProduct.variants.length > 1)
  );
  const [singleSku, setSingleSku] = useState(
    initialProduct?.variants?.[0]?.sku || (initialProduct?.id ? `VE-${initialProduct.id.slice(0, 6).toUpperCase()}` : "")
  );
  const [singlePrice, setSinglePrice] = useState<number | "">(
    initialProduct?.variants?.[0]?.price ?? initialProduct?.basePrice ?? ""
  );
  const [singleMrp, setSingleMrp] = useState<number | "">(
    initialProduct?.variants?.[0]?.mrp ?? ""
  );
  const [singleStock, setSingleStock] = useState<number>(
    initialProduct?.variants?.[0]?.stock ?? 0
  );

  // Multi-variant items
  const [matrixVariants, setMatrixVariants] = useState<VariantMatrixItem[]>(() => {
    if (initialProduct?.variants && initialProduct.variants.length > 1) {
      return initialProduct.variants.map((v: any, idx: number) => ({
        id: v.id,
        tempId: v.id || `v-${idx}`,
        title: v.title,
        sku: v.sku || "",
        price: v.price || 0,
        mrp: v.mrp || null,
        stock: v.stock || 0,
        isActive: v.isActive !== false,
        isExisting: true,
        combination: v.attributeValues?.map((av: any) => ({
          attributeId: av.attribute?.id || av.attributeId,
          attributeName: av.attribute?.name || "Attribute",
          attributeValueId: av.attributeValue?.id || av.attributeValueId,
          label: av.attributeValue?.label || "Value",
          code: av.attributeValue?.code || "",
          swatchHex: av.attributeValue?.swatchHex,
        })) || [],
      }));
    }
    return [];
  });

  // Images state
  const [mediaItems, setMediaItems] = useState<UploadedMediaItem[]>(() => {
    if (initialProduct?.images && initialProduct.images.length > 0) {
      return initialProduct.images.map((img: any, idx: number) => ({
        id: img.id || img.imageId,
        url: img.image?.url || img.url || "",
        filename: img.image?.filename || `image-${idx + 1}.jpg`,
        size: img.image?.size || 1024 * 500,
        width: img.image?.width || 1000,
        height: img.image?.height || 1000,
        isMain: Boolean(img.isMain || idx === 0),
        altText: img.altText || img.image?.alt || "",
      }));
    }
    return [];
  });

  // Attribute values state (record of attributeId -> value)
  const [attributeValues, setAttributeValues] = useState<
    Record<string, { attributeValueId?: string; textValue?: string; numberValue?: number; boolValue?: boolean }>
  >(() => {
    const map: Record<string, any> = {};
    if (initialProduct?.attributeValues) {
      for (const av of initialProduct.attributeValues) {
        map[av.attributeId] = {
          attributeValueId: av.attributeValueId,
          textValue: av.textValue,
          numberValue: av.numberValue,
          boolValue: av.boolValue,
        };
      }
    }
    return map;
  });

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<string>("Draft saved");
  const [autosaveError, setAutosaveError] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishGateResult, setPublishGateResult] = useState<PublishGateResult | null>(null);
  const [categoryConfirmOpen, setCategoryConfirmOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<Category | null>(null);
  const [lostAttributesWarning, setLostAttributesWarning] = useState<string[]>([]);
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("basics");
  const [altTextModalOpen, setAltTextModalOpen] = useState(false);
  const [editingImageAlt, setEditingImageAlt] = useState<{ id: string; altText: string } | null>(null);

  // Selected Category Object
  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === categoryId);
  }, [categories, categoryId]);

  // Sub-categories list
  const subCategories = useMemo(() => {
    if (!categoryId) return [];
    return categories.filter((c) => c.parentId === categoryId);
  }, [categories, categoryId]);

  // Inherited HSN code
  const inheritedHsn = selectedCategory?.hsnCode || "8541";
  const activeHsn = isHsnOverridden ? hsnCodeOverride : inheritedHsn;

  // ─── AUTO-SLUG GENERATION ────────────────────────────────────────────────
  useEffect(() => {
    if (!isSlugUserModified && title) {
      setSlug(generateSlug(title));
    }
  }, [title, isSlugUserModified]);

  // ─── DYNAMIC ATTRIBUTES LIST ─────────────────────────────────────────────
  const categoryAttributes = useMemo(() => {
    if (!selectedCategory || !selectedCategory.categoryAttributes) return [];
    return selectedCategory.categoryAttributes;
  }, [selectedCategory]);

  // ─── LIVE PUBLISH GATE EVALUATION ────────────────────────────────────────
  const currentGate = useMemo(() => {
    const activeVariants = isMultiVariant
      ? matrixVariants.map((v) => ({
          title: v.title,
          price: v.price,
          mrp: v.mrp,
          stock: v.stock,
          isActive: v.isActive,
          sku: v.sku,
        }))
      : [
          {
            title: "Standard",
            price: typeof singlePrice === "number" ? singlePrice : 0,
            mrp: typeof singleMrp === "number" ? singleMrp : null,
            stock: singleStock,
            isActive: true,
            sku: singleSku,
          },
        ];

    const mappedAttrValues = Object.entries(attributeValues).map(([attrId, val]) => ({
      attributeId: attrId,
      ...val,
    }));

    const categoryContext = {
      id: selectedCategory?.id,
      name: selectedCategory?.name,
      hsnCode: selectedCategory?.hsnCode,
      requiredAttributeIds: categoryAttributes
        .filter((ca) => ca.isRequired)
        .map((ca) => ({ id: ca.attribute.id, name: ca.attribute.name })),
    };

    return evaluatePublishGate(
      {
        title,
        description,
        categoryId,
        brandId,
        unit,
        hsnCode: activeHsn,
        metaDescription,
        images: mediaItems.map((m) => ({ imageId: m.id, altText: m.altText })),
        variants: activeVariants,
        attributeValues: mappedAttrValues,
      },
      categoryContext
    );
  }, [
    title,
    description,
    categoryId,
    brandId,
    unit,
    activeHsn,
    metaDescription,
    mediaItems,
    isMultiVariant,
    matrixVariants,
    singlePrice,
    singleMrp,
    singleStock,
    singleSku,
    attributeValues,
    selectedCategory,
    categoryAttributes,
  ]);

  // ─── SECTION COMPLETENESS CALCULATORS ────────────────────────────────────
  const sectionCompleteness = useMemo(() => {
    return {
      basics: title.trim().length >= 3 && description.trim().length >= 10,
      media: mediaItems.length >= 1,
      organisation: Boolean(categoryId && brandId && unit && activeHsn),
      attributes: (() => {
        const required = categoryAttributes.filter((ca) => ca.isRequired);
        if (required.length === 0) return true;
        return required.every((req) => {
          const v = attributeValues[req.attribute.id];
          return v && (v.attributeValueId || v.textValue || v.numberValue !== undefined || v.boolValue !== undefined);
        });
      })(),
      variants: (() => {
        if (!isMultiVariant) {
          return typeof singlePrice === "number" && singlePrice > 0;
        }
        return (
          matrixVariants.length > 0 &&
          matrixVariants.filter((v) => v.isActive).length > 0 &&
          matrixVariants.every((v) => !v.isActive || (Number(v.price) > 0 && (!v.mrp || Number(v.price) <= Number(v.mrp))))
        );
      })(),
      shipping: true, // Optional with sensible defaults
      seo: true, // Always optional
    };
  }, [
    title,
    description,
    mediaItems,
    categoryId,
    brandId,
    unit,
    activeHsn,
    categoryAttributes,
    attributeValues,
    isMultiVariant,
    singlePrice,
    matrixVariants,
  ]);

  // ─── AUTOSAVE ENGINE (30s interval + tab blur) ───────────────────────────
  const formDataSnapshot = useMemo(() => {
    const activeVariants = isMultiVariant
      ? matrixVariants.map((v, idx) => ({
          id: v.id,
          title: v.title,
          sku: v.sku,
          price: Number(v.price),
          mrp: v.mrp ? Number(v.mrp) : null,
          stock: Number(v.stock),
          isActive: v.isActive,
          position: idx,
          isDefault: idx === 0,
          attributeValues: v.combination.map((c) => ({
            attributeId: c.attributeId,
            attributeValueId: c.attributeValueId,
          })),
        }))
      : [
          {
            title: "Standard",
            sku: singleSku,
            price: typeof singlePrice === "number" ? singlePrice : null,
            mrp: typeof singleMrp === "number" ? singleMrp : null,
            stock: singleStock,
            isActive: true,
            isDefault: true,
            position: 0,
          },
        ];

    const mappedAttrValues = Object.entries(attributeValues).map(([attrId, val]) => ({
      attributeId: attrId,
      ...val,
    }));

    return {
      id,
      title,
      slug,
      shortDescription,
      description,
      basePrice: typeof singlePrice === "number" ? singlePrice : 0,
      categoryId,
      brandId: brandId || null,
      unit,
      hsnCode: isHsnOverridden ? hsnCodeOverride : null,
      status,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      version,
      images: mediaItems.map((img, idx) => ({
        imageId: img.id,
        sortOrder: idx,
        isMain: img.isMain || idx === 0,
        altText: img.altText || null,
        url: img.url,
      })),
      variants: activeVariants,
      attributeValues: mappedAttrValues,
    };
  }, [
    id,
    title,
    slug,
    shortDescription,
    description,
    singlePrice,
    categoryId,
    brandId,
    unit,
    isHsnOverridden,
    hsnCodeOverride,
    status,
    metaTitle,
    metaDescription,
    version,
    mediaItems,
    isMultiVariant,
    matrixVariants,
    singleSku,
    singleMrp,
    singleStock,
    attributeValues,
  ]);

  const runAutosave = async (isManual = false) => {
    if (!title || title.trim().length === 0) return;
    try {
      setAutosaveStatus("Saving draft...");
      setAutosaveError(false);
      const res = await saveProductDraft(formDataSnapshot);
      if (res.success && res.product) {
        if (!id && res.product.id) {
          setId(res.product.id);
          window.history.replaceState(null, "", `/admin/products/${res.product.id}/edit`);
        }
        setAutosaveStatus(`Draft saved ${res.savedAt}`);
        if (isManual) {
          toast.success("Draft Saved", `Product draft saved at ${res.savedAt}`);
        }
      } else {
        setAutosaveStatus("Couldn't save draft — retrying");
        setAutosaveError(true);
      }
    } catch (err) {
      setAutosaveStatus("Couldn't save draft — retrying");
      setAutosaveError(true);
    }
  };

  // 30-second interval autosave
  useEffect(() => {
    const timer = setInterval(() => {
      runAutosave(false);
    }, 30000);
    return () => clearInterval(timer);
  }, [formDataSnapshot]);

  // Tab blur autosave
  useEffect(() => {
    const handleBlur = () => runAutosave(false);
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [formDataSnapshot]);

  // ─── CATEGORY CHANGE GUARDRAIL ───────────────────────────────────────────
  const handleCategorySelect = (newCatId: string) => {
    if (!newCatId || newCatId === categoryId) return;
    const targetCat = categories.find((c) => c.id === newCatId);
    if (!targetCat) return;

    // Check if current category has attributes filled
    const filledAttrCount = Object.keys(attributeValues).length;
    if (filledAttrCount > 0) {
      const allowedInTarget = (targetCat.categoryAttributes || []).map((ca) => ca.attribute.id);
      const lostNames = categoryAttributes
        .filter((ca) => !allowedInTarget.includes(ca.attribute.id) && attributeValues[ca.attribute.id])
        .map((ca) => ca.attribute.name);

      if (lostNames.length > 0) {
        setLostAttributesWarning(lostNames);
        setPendingCategory(targetCat);
        setCategoryConfirmOpen(true);
        return;
      }
    }

    applyCategoryChange(targetCat);
  };

  const applyCategoryChange = (targetCat: Category) => {
    setCategoryId(targetCat.id);
    setSubCategoryId("");
    if (targetCat.hsnCode && !isHsnOverridden) {
      setHsnCodeOverride(targetCat.hsnCode);
    }
    // Clean up non-shared attributes
    const allowedIds = (targetCat.categoryAttributes || []).map((ca) => ca.attribute.id);
    setAttributeValues((prev) => {
      const next: Record<string, any> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (allowedIds.includes(k)) next[k] = v;
      }
      return next;
    });
    setCategoryConfirmOpen(false);
    setPendingCategory(null);
  };

  // ─── PUBLISH HANDLER (FR-14) ─────────────────────────────────────────────
  const handlePublish = async () => {
    if (!currentGate.canPublish) {
      setPublishGateResult(currentGate);
      setIsPublishModalOpen(true);
      return;
    }

    setIsPublishing(true);
    try {
      // Save draft first, then publish
      const saveRes = await saveProductDraft(formDataSnapshot);
      if (!saveRes.success) {
        toast.error("Save Failed", saveRes.error || "Could not save product data");
        setIsPublishing(false);
        return;
      }

      const targetId = (id || saveRes.product?.id) as string;
      const pubRes = await publishProduct(targetId);

      if (pubRes.success) {
        setStatus("ACTIVE");
        toast.success(
          `${title} is now live!`,
          "Product has been verified and published to the storefront."
        );
        router.push("/admin/products");
      } else if (pubRes.status === 422) {
        setPublishGateResult({
          canPublish: false,
          checks: pubRes.checks || [],
          blockingIssues: pubRes.blockingIssues || [],
          warnings: pubRes.warnings || [],
        });
        setIsPublishModalOpen(true);
      } else {
        toast.error("Publish Failed", pubRes.error || "Failed to publish product");
      }
    } catch (err: any) {
      toast.error("Publish Error", err.message || "An unexpected error occurred");
    } finally {
      setIsPublishing(false);
    }
  };

  // ─── CREATE INLINE BRAND ─────────────────────────────────────────────────
  const handleCreateBrand = () => {
    if (!newBrandName.trim()) return;
    const newBrand: Brand = {
      id: `brand-${Date.now()}`,
      name: newBrandName.trim(),
      slug: generateSlug(newBrandName),
    };
    setBrands((prev) => [...prev, newBrand]);
    setBrandId(newBrand.id);
    setNewBrandName("");
    setIsNewBrandModalOpen(false);
    toast.success("Brand Added", `Brand "${newBrand.name}" ready to assign`);
  };

  return (
    <div className="min-h-screen pb-24 bg-[var(--color-surface-sunken)]">
      {/* ─── STICKY HEADER ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[var(--color-surface)] border-b border-[var(--color-border)] shadow-xs px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)] transition-colors"
            title="Back to Products"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-xs)] font-medium text-[var(--color-fg-muted)]">
                Products /
              </span>
              <h1 className="text-[var(--text-lg)] font-bold text-[var(--color-fg)] truncate max-w-xs sm:max-w-md">
                {title || "Untitled Product"}
              </h1>
              <StatusBadge status={status} />
            </div>
            <p
              className={cn(
                "text-[11px] flex items-center gap-1.5 transition-colors",
                autosaveError ? "text-[var(--color-warning)]" : "text-[var(--color-fg-muted)]"
              )}
            >
              <Clock size={12} />
              {autosaveStatus}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Status Dropdown */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="h-9 px-3 text-[var(--text-xs)] font-medium bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-fg)] focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active (Live)</option>
            <option value="INACTIVE">Inactive (Off sale)</option>
            <option value="ARCHIVED">Archived (Retired)</option>
          </select>

          {/* Save Draft */}
          <button
            type="button"
            onClick={() => runAutosave(true)}
            disabled={isSaving}
            className="h-9 px-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-fg)] text-[var(--text-sm)] font-medium flex items-center gap-1.5 transition-colors"
          >
            <Save size={15} />
            Save Draft
          </button>

          {/* Publish / Save Changes */}
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className={cn(
              "h-9 px-4 rounded-[var(--radius-md)] text-white text-[var(--text-sm)] font-medium flex items-center gap-1.5 shadow-xs transition-all",
              status === "ACTIVE"
                ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
                : currentGate.canPublish
                ? "bg-[var(--color-success)] hover:opacity-90"
                : "bg-[var(--color-primary)] opacity-85 hover:opacity-100"
            )}
          >
            {isPublishing ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : status === "ACTIVE" ? (
              <CheckCircle2 size={15} />
            ) : (
              <Send size={15} />
            )}
            {status === "ACTIVE" ? "Save Changes" : "Publish Product"}
          </button>
        </div>
      </header>

      {/* ─── MAIN CONTENT LAYOUT (FLUID MAIN + 320PX SIDE) ──────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Sections 1 to 7 */}
        <div className="lg:col-span-8 space-y-6">
          {/* SECTION 1: BASICS */}
          <section
            id="section-basics"
            className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 shadow-2xs scroll-mt-20"
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--color-border-subtle)]">
              <div>
                <h2 className="text-[var(--text-md)] font-bold text-[var(--color-fg)]">
                  1. Basics
                </h2>
                <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                  Primary listing details, web URL address, and customer descriptions.
                </p>
              </div>
              <span
                className={cn(
                  "w-3 h-3 rounded-full",
                  sectionCompleteness.basics ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"
                )}
                title={sectionCompleteness.basics ? "Complete" : "Incomplete"}
              />
            </div>

            <div className="space-y-4">
              {/* Product Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)]">
                    Product Name <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  {title.length >= 150 && (
                    <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">
                      {title.length}/200
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={title}
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 1200mm Brushless BLDC Ceiling Fan with Remote"
                  className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)] focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 flex items-center justify-between">
                  <span>
                    URL Slug <span className="text-[var(--color-danger)]">*</span>
                  </span>
                  <span className="text-[11px] font-normal text-[var(--color-fg-muted)]">
                    vaishnavi.com/product/<strong>{slug || "your-slug"}</strong>
                  </span>
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                    setIsSlugUserModified(true);
                  }}
                  placeholder="cotton-kurta-set"
                  className="w-full h-10 px-3 font-mono text-[var(--text-xs)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                {status === "ACTIVE" && isSlugUserModified && (
                  <p className="text-[11px] text-[var(--color-warning)] mt-1 flex items-center gap-1">
                    <AlertTriangle size={13} />
                    Changing the slug on a live product breaks existing customer links and bookmarks.
                  </p>
                )}
              </div>

              {/* Short Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)]">
                    Short Description
                  </label>
                  <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">
                    {shortDescription.length}/300
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Shown on category listing cards, search results, and mobile previews."
                  className="w-full p-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)] focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              {/* Detailed Description */}
              <div>
                <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
                  Detailed Description <span className="text-[var(--color-danger)]">*</span>
                </label>
                {/* Standard Rich Text Controls */}
                <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
                  <div className="bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] px-3 py-1.5 flex flex-wrap items-center gap-1 text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                    <button
                      type="button"
                      onClick={() => setDescription((prev: string) => prev + " **Bold**")}
                      className="px-2 py-0.5 rounded hover:bg-[var(--color-surface-hover)] font-bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => setDescription((prev: string) => prev + " *Italic*")}
                      className="px-2 py-0.5 rounded hover:bg-[var(--color-surface-hover)] italic"
                    >
                      I
                    </button>
                    <span className="text-[var(--color-border)]">|</span>
                    <button
                      type="button"
                      onClick={() => setDescription((prev: string) => prev + "\n## Heading 2\n")}
                      className="px-2 py-0.5 rounded hover:bg-[var(--color-surface-hover)] font-semibold"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => setDescription((prev: string) => prev + "\n### Heading 3\n")}
                      className="px-2 py-0.5 rounded hover:bg-[var(--color-surface-hover)]"
                    >
                      H3
                    </button>
                    <span className="text-[var(--color-border)]">|</span>
                    <button
                      type="button"
                      onClick={() => setDescription((prev: string) => prev + "\n- Bullet item\n")}
                      className="px-2 py-0.5 rounded hover:bg-[var(--color-surface-hover)]"
                    >
                      • List
                    </button>
                    <button
                      type="button"
                      onClick={() => setDescription((prev: string) => prev + "\n1. Numbered item\n")}
                      className="px-2 py-0.5 rounded hover:bg-[var(--color-surface-hover)]"
                    >
                      1. List
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter comprehensive product features, technical specifications, and warranty details..."
                    className="w-full p-3 bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: MEDIA */}
          <section
            id="section-media"
            className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 shadow-2xs scroll-mt-20"
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--color-border-subtle)]">
              <div>
                <h2 className="text-[var(--text-md)] font-bold text-[var(--color-fg)]">
                  2. Media & Photography
                </h2>
                <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                  Upload 1–10 high-resolution images. Minimum 800×800px. First image is the primary storefront photo.
                </p>
              </div>
              <span
                className={cn(
                  "w-3 h-3 rounded-full",
                  sectionCompleteness.media ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"
                )}
              />
            </div>

            <MediaUploader
              items={mediaItems}
              onChange={setMediaItems}
              maxFiles={10}
              maxSizeMB={5}
              minDimensions={{ width: 800, height: 800 }}
            />

            {/* Alt Text Warning / Edit Link */}
            {mediaItems.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-2 text-[var(--text-xs)]">
                <span className="text-[var(--color-fg-muted)]">
                  {mediaItems.filter((m) => m.altText).length} of {mediaItems.length} images have accessibility alt text.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const firstMissing = mediaItems.find((m) => !m.altText) || mediaItems[0];
                    setEditingImageAlt({ id: firstMissing.id, altText: firstMissing.altText || "" });
                    setAltTextModalOpen(true);
                  }}
                  className="text-[var(--color-primary)] hover:underline font-medium flex items-center gap-1"
                >
                  <Edit3 size={13} /> Edit Image Alt Text
                </button>
              </div>
            )}
          </section>

          {/* SECTION 3: ORGANISATION */}
          <section
            id="section-organisation"
            className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 shadow-2xs scroll-mt-20"
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--color-border-subtle)]">
              <div>
                <h2 className="text-[var(--text-md)] font-bold text-[var(--color-fg)]">
                  3. Organisation & Tax
                </h2>
                <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                  Category taxonomy, brand identity, inventory unit, and GST HSN classification.
                </p>
              </div>
              <span
                className={cn(
                  "w-3 h-3 rounded-full",
                  sectionCompleteness.organisation ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
                  Category <span className="text-[var(--color-danger)]">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => handleCategorySelect(e.target.value)}
                  className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)] focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">Select Category...</option>
                  {categories
                    .filter((c) => !c.parentId)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Sub-Category */}
              <div>
                <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
                  Sub-Category
                </label>
                <select
                  value={subCategoryId}
                  onChange={(e) => setSubCategoryId(e.target.value)}
                  disabled={subCategories.length === 0}
                  className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)] disabled:opacity-50 focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">
                    {subCategories.length === 0 ? "No Sub-Categories" : "Select Sub-Category..."}
                  </option>
                  {subCategories.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Brand */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)]">
                    Brand <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsNewBrandModalOpen(true)}
                    className="text-[11px] text-[var(--color-primary)] hover:underline font-medium flex items-center gap-0.5"
                  >
                    <Plus size={12} /> Add Brand
                  </button>
                </div>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)] focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">Select Brand...</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit of Measurement */}
              <div>
                <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
                  Unit of Measurement <span className="text-[var(--color-danger)]">*</span>
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)] focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="Piece">Piece (pcs)</option>
                  <option value="Set">Set (set)</option>
                  <option value="Pair">Pair (pr)</option>
                  <option value="Kilogram">Kilogram (kg)</option>
                  <option value="Gram">Gram (g)</option>
                  <option value="Litre">Litre (l)</option>
                  <option value="Millilitre">Millilitre (ml)</option>
                  <option value="Metre">Metre (m)</option>
                  <option value="Centimetre">Centimetre (cm)</option>
                  <option value="Box">Box (box)</option>
                  <option value="Dozen">Dozen (dz)</option>
                  <option value="Packet">Packet (pkt)</option>
                </select>
              </div>

              {/* HSN Code with Inheritance & Override */}
              <div className="sm:col-span-2 pt-2">
                <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
                  Tax Classification (HSN Code)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {isHsnOverridden ? (
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-[var(--radius-sm)] bg-purple-100 text-purple-800 text-[var(--text-xs)] font-bold">
                        Overridden
                      </span>
                      <input
                        type="text"
                        value={hsnCodeOverride}
                        onChange={(e) => setHsnCodeOverride(e.target.value)}
                        placeholder="Enter HSN Override"
                        className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-[var(--text-sm)] w-40"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsHsnOverridden(false);
                          setHsnCodeOverride("");
                        }}
                        className="text-[var(--text-xs)] text-[var(--color-fg-muted)] hover:underline"
                      >
                        Revert to category ({inheritedHsn})
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--text-xs)] font-mono text-[var(--color-fg)]">
                        {inheritedHsn} · {selectedCategory?.gstRate || 18}% GST · inherited from{" "}
                        {selectedCategory?.name || "Category"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsHsnOverridden(true)}
                        className="text-[var(--text-xs)] text-[var(--color-primary)] hover:underline font-medium"
                      >
                        [Override]
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: ATTRIBUTES */}
          <section
            id="section-attributes"
            className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 shadow-2xs scroll-mt-20"
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--color-border-subtle)]">
              <div>
                <h2 className="text-[var(--text-md)] font-bold text-[var(--color-fg)]">
                  4. Category Attributes
                </h2>
                <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                  Technical specifications derived from {selectedCategory?.name || "the selected category"}.
                  <span className="text-[var(--color-danger)] font-medium"> * Required to publish</span>
                </p>
              </div>
              <span
                className={cn(
                  "w-3 h-3 rounded-full",
                  sectionCompleteness.attributes ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"
                )}
              />
            </div>

            {categoryAttributes.length === 0 ? (
              <div className="p-6 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] text-center text-[var(--color-fg-muted)] text-[var(--text-sm)]">
                {selectedCategory ? (
                  <>
                    Category <strong>{selectedCategory.name}</strong> has no attributes configured.
                    <Link
                      href={`/admin/categories`}
                      className="text-[var(--color-primary)] hover:underline ml-1 font-medium inline-flex items-center gap-0.5"
                    >
                      Configure attributes →
                    </Link>
                  </>
                ) : (
                  "Select a category above to load technical attributes."
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categoryAttributes.map((ca) => {
                  const attr = ca.attribute;
                  const currentVal = attributeValues[attr.id];

                  return (
                    <div key={attr.id} className="space-y-1">
                      <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] flex items-center justify-between">
                        <span>
                          {attr.name}{" "}
                          {ca.isRequired && (
                            <span className="text-[var(--color-danger)]">*</span>
                          )}
                        </span>
                        <span className="text-[10px] uppercase font-mono text-[var(--color-fg-muted)]">
                          {attr.inputType}
                        </span>
                      </label>

                      {/* Dropdown for SELECT */}
                      {attr.inputType === "SINGLE_SELECT" ? (
                        <select
                          value={currentVal?.attributeValueId || ""}
                          onChange={(e) =>
                            setAttributeValues((prev) => ({
                              ...prev,
                              [attr.id]: { attributeValueId: e.target.value },
                            }))
                          }
                          className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)] focus:ring-2 focus:ring-[var(--color-primary)]"
                        >
                          <option value="">Select {attr.name}...</option>
                          {attr.values?.map((val) => (
                            <option key={val.id} value={val.id}>
                              {val.label}
                            </option>
                          ))}
                        </select>
                      ) : attr.inputType === "NUMBER" ? (
                        <input
                          type="number"
                          value={currentVal?.numberValue ?? ""}
                          onChange={(e) =>
                            setAttributeValues((prev) => ({
                              ...prev,
                              [attr.id]: {
                                numberValue: e.target.value ? Number(e.target.value) : undefined,
                              },
                            }))
                          }
                          placeholder={`Enter ${attr.name}`}
                          className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)]"
                        />
                      ) : attr.inputType === "BOOLEAN" ? (
                        <div className="flex items-center gap-4 pt-2">
                          <label className="flex items-center gap-2 text-[var(--text-sm)]">
                            <input
                              type="radio"
                              name={`bool-${attr.id}`}
                              checked={currentVal?.boolValue === true}
                              onChange={() =>
                                setAttributeValues((prev) => ({
                                  ...prev,
                                  [attr.id]: { boolValue: true },
                                }))
                              }
                            />
                            Yes
                          </label>
                          <label className="flex items-center gap-2 text-[var(--text-sm)]">
                            <input
                              type="radio"
                              name={`bool-${attr.id}`}
                              checked={currentVal?.boolValue === false}
                              onChange={() =>
                                setAttributeValues((prev) => ({
                                  ...prev,
                                  [attr.id]: { boolValue: false },
                                }))
                              }
                            />
                            No
                          </label>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={currentVal?.textValue || ""}
                          onChange={(e) =>
                            setAttributeValues((prev) => ({
                              ...prev,
                              [attr.id]: { textValue: e.target.value },
                            }))
                          }
                          placeholder={`Enter ${attr.name}`}
                          className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)]"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* SECTION 5: VARIANTS & PRICING */}
          <section
            id="section-variants"
            className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 shadow-2xs scroll-mt-20"
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--color-border-subtle)]">
              <div>
                <h2 className="text-[var(--text-md)] font-bold text-[var(--color-fg)]">
                  5. Variants & Pricing
                </h2>
                <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                  Configure single item SKU or build combinations across colors, sizes, and capacities.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-[var(--text-xs)] font-medium text-[var(--color-fg)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMultiVariant}
                    onChange={(e) => setIsMultiVariant(e.target.checked)}
                    className="rounded text-[var(--color-primary)]"
                  />
                  This product has multiple variants (e.g. sizes/colors)
                </label>
                <span
                  className={cn(
                    "w-3 h-3 rounded-full",
                    sectionCompleteness.variants ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"
                  )}
                />
              </div>
            </div>

            {!isMultiVariant ? (
              /* Single-SKU Inline Path */
              <div className="space-y-4">
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Tag size={16} className="text-[var(--color-primary)]" />
                    <span className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)]">
                      Single SKU:
                    </span>
                    <input
                      type="text"
                      value={singleSku}
                      onChange={(e) => setSingleSku(e.target.value.toUpperCase())}
                      placeholder="e.g. VE-SPICE-TUR-500"
                      className="h-8 px-2 font-mono text-[var(--text-xs)] uppercase rounded border border-[var(--color-border)] bg-[var(--color-surface)] w-48"
                    />
                  </div>
                  <span className="text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                    Single item product with default hidden variant (D-05)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Selling Price */}
                  <div>
                    <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
                      Selling Price (₹) <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-[var(--color-fg-muted)]">₹</span>
                      <input
                        type="number"
                        value={singlePrice}
                        min={0}
                        onChange={(e) =>
                          setSinglePrice(e.target.value ? Number(e.target.value) : "")
                        }
                        placeholder="0.00"
                        className="w-full h-10 pl-7 pr-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-[var(--text-sm)]"
                      />
                    </div>
                  </div>

                  {/* MRP */}
                  <div>
                    <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
                      MRP (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-[var(--color-fg-muted)]">₹</span>
                      <input
                        type="number"
                        value={singleMrp}
                        min={0}
                        onChange={(e) => setSingleMrp(e.target.value ? Number(e.target.value) : "")}
                        placeholder="0.00"
                        className="w-full h-10 pl-7 pr-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-[var(--text-sm)]"
                      />
                    </div>
                  </div>

                  {/* Stock */}
                  <div>
                    <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
                      Initial Stock Count
                    </label>
                    <input
                      type="number"
                      value={singleStock}
                      min={0}
                      onChange={(e) => setSingleStock(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-[var(--text-sm)]"
                    />
                  </div>
                </div>

                {typeof singlePrice === "number" &&
                  typeof singleMrp === "number" &&
                  singleMrp > 0 &&
                  singlePrice > singleMrp && (
                    <p className="text-[var(--text-xs)] text-[var(--color-danger)] font-medium flex items-center gap-1">
                      <AlertCircle size={14} /> Selling price cannot be greater than MRP.
                    </p>
                  )}
              </div>
            ) : (
              /* Multi-Variant Matrix Builder Path */
              <div className="space-y-4">
                <VariantMatrixBuilder
                  categoryId={categoryId}
                  categoryName={selectedCategory?.name}
                  brandSlug={brands.find((b) => b.id === brandId)?.slug || "ve"}
                  categorySlug={selectedCategory?.slug || "cat"}
                  productTitle={title || "Product"}
                  basePrice={typeof singlePrice === "number" ? singlePrice : 0}
                  baseMrp={typeof singleMrp === "number" ? singleMrp : undefined}
                  variants={matrixVariants}
                  onChange={setMatrixVariants}
                  singleSku={singleSku}
                  onSingleSkuChange={setSingleSku}
                />
              </div>
            )}
          </section>

          {/* SECTION 6: SHIPPING */}
          <section
            id="section-shipping"
            className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 shadow-2xs scroll-mt-20"
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--color-border-subtle)]">
              <div>
                <h2 className="text-[var(--text-md)] font-bold text-[var(--color-fg)]">
                  6. Shipping & Packaging
                </h2>
                <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                  Package dimensions and weight used for logistics rate computation.
                </p>
              </div>
              <span className="w-3 h-3 rounded-full bg-[var(--color-success)]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Weight */}
              <div>
                <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
                  Weight
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={weightGrams}
                    onChange={(e) => setWeightGrams(e.target.value ? Number(e.target.value) : "")}
                    placeholder="e.g. 450"
                    className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-[var(--text-sm)]"
                  />
                  <select
                    value={weightUnit}
                    onChange={(e) => setWeightUnit(e.target.value as any)}
                    className="h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] font-medium text-[var(--text-sm)]"
                  >
                    <option value="g">grams (g)</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              {/* Dimensions */}
              <div>
                <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
                  Dimensions (L × W × H in cm)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    value={lengthMm}
                    onChange={(e) => setLengthMm(e.target.value ? Number(e.target.value) : "")}
                    placeholder="L"
                    className="h-10 px-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-[var(--text-sm)] text-center"
                  />
                  <input
                    type="number"
                    value={widthMm}
                    onChange={(e) => setWidthMm(e.target.value ? Number(e.target.value) : "")}
                    placeholder="W"
                    className="h-10 px-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-[var(--text-sm)] text-center"
                  />
                  <input
                    type="number"
                    value={heightMm}
                    onChange={(e) => setHeightMm(e.target.value ? Number(e.target.value) : "")}
                    placeholder="H"
                    className="h-10 px-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-[var(--text-sm)] text-center"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 pt-2">
                <label className="flex items-center gap-2 text-[var(--text-xs)] text-[var(--color-fg)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameDimensionsForAll}
                    onChange={(e) => setSameDimensionsForAll(e.target.checked)}
                    className="rounded text-[var(--color-primary)]"
                  />
                  Same shipping dimensions for all variants (recommended)
                </label>
              </div>
            </div>
          </section>

          {/* SECTION 7: SEO */}
          <section
            id="section-seo"
            className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 shadow-2xs scroll-mt-20"
          >
            <div
              onClick={() => setIsSeoOpen(!isSeoOpen)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div>
                <h2 className="text-[var(--text-md)] font-bold text-[var(--color-fg)] flex items-center gap-2">
                  7. Search Engine Optimisation (SEO)
                  <span className="text-[11px] font-normal text-[var(--color-fg-muted)]">
                    (Optional)
                  </span>
                </h2>
                <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                  Custom page title and description for Google search snippets.
                </p>
              </div>
              <button type="button" className="p-1 text-[var(--color-fg-muted)]">
                {isSeoOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
            </div>

            {isSeoOpen && (
              <div className="space-y-4 pt-4 mt-4 border-t border-[var(--color-border-subtle)]">
                {/* Meta Title */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)]">
                      Meta Title
                    </label>
                    <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">
                      {metaTitle.length}/60
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={60}
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    placeholder={title || "Auto-fills from product name"}
                    className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)]"
                  />
                </div>

                {/* Meta Description */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)]">
                      Meta Description
                    </label>
                    <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">
                      {metaDescription.length}/160
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={160}
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    placeholder="Enter an enticing summary for Google search result preview..."
                    className="w-full p-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)]"
                  />
                </div>

                {/* Google Preview Snippet Card */}
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]">
                  <span className="text-[11px] uppercase font-bold text-[var(--color-fg-muted)] tracking-wider block mb-2">
                    Search Result Preview
                  </span>
                  <p className="text-[13px] text-blue-700 font-medium truncate hover:underline cursor-pointer">
                    {metaTitle || title || "Product Title"} — Vaishnavi Enterprises
                  </p>
                  <p className="text-[11px] text-green-700 truncate font-mono">
                    https://vaishnavi.com/product/{slug || "cotton-kurta-set"}
                  </p>
                  <p className="text-[12px] text-[var(--color-fg-muted)] line-clamp-2 mt-0.5">
                    {metaDescription || shortDescription || description || "No description preview available."}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Sticky Column (320px): Section Completeness & Readiness */}
        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-20 space-y-6">
            {/* Section Completeness Rail */}
            <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 shadow-2xs">
              <h3 className="text-[var(--text-xs)] font-bold uppercase tracking-wider text-[var(--color-fg-muted)] mb-3">
                Sections Progress
              </h3>
              <nav className="space-y-1 text-[var(--text-xs)]">
                {[
                  { id: "section-basics", label: "1. Basics", complete: sectionCompleteness.basics },
                  { id: "section-media", label: "2. Media", complete: sectionCompleteness.media },
                  { id: "section-organisation", label: "3. Organisation", complete: sectionCompleteness.organisation },
                  { id: "section-attributes", label: "4. Attributes", complete: sectionCompleteness.attributes },
                  { id: "section-variants", label: "5. Variants", complete: sectionCompleteness.variants },
                  { id: "section-shipping", label: "6. Shipping", complete: sectionCompleteness.shipping },
                  { id: "section-seo", label: "7. SEO", complete: sectionCompleteness.seo },
                ].map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-fg)] font-medium transition-colors"
                  >
                    <span>{sec.label}</span>
                    <span
                      className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        sec.complete ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"
                      )}
                    />
                  </a>
                ))}
              </nav>
            </div>

            {/* Live Publish Readiness Panel */}
            <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5 shadow-2xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--text-xs)] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
                  Publish Readiness
                </span>
                <StatusBadge status={status} />
              </div>

              {/* Blocking Issues */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase text-[var(--color-danger)] block">
                  Must Fix ({currentGate.blockingIssues.length})
                </span>
                {currentGate.blockingIssues.length === 0 ? (
                  <p className="text-[var(--text-xs)] text-[var(--color-success)] flex items-center gap-1.5 font-medium">
                    <CheckCircle2 size={14} /> Ready to go live
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-[var(--text-xs)]">
                    {currentGate.blockingIssues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-[var(--color-danger)]">
                        <X size={13} className="flex-shrink-0 mt-0.5" />
                        <a href={issue.anchor} className="hover:underline flex-1">
                          {issue.message}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Warnings */}
              {currentGate.warnings.length > 0 && (
                <div className="space-y-2 pt-3 mt-3 border-t border-[var(--color-border-subtle)]">
                  <span className="text-[11px] font-bold uppercase text-[var(--color-warning)] block">
                    Worth Fixing ({currentGate.warnings.length})
                  </span>
                  <ul className="space-y-1 text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                    {currentGate.warnings.map((warn, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <AlertTriangle size={13} className="text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
                        <a href={warn.anchor} className="hover:underline flex-1">
                          {warn.message}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action */}
              <div className="pt-4 mt-4 border-t border-[var(--color-border-subtle)]">
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className={cn(
                    "w-full py-2.5 rounded-[var(--radius-md)] text-white text-[var(--text-sm)] font-bold flex items-center justify-center gap-2 shadow-xs transition-all",
                    currentGate.canPublish
                      ? "bg-[var(--color-success)] hover:opacity-90"
                      : "bg-[var(--color-primary)] opacity-85 hover:opacity-100"
                  )}
                >
                  <Send size={15} />
                  {status === "ACTIVE" ? "Save Live Changes" : "Publish to Storefront"}
                </button>
              </div>
            </div>

            {/* Quick Stats (in Edit Mode) */}
            {isEditMode && initialProduct && (
              <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 shadow-2xs space-y-3">
                <span className="text-[var(--text-xs)] font-bold uppercase tracking-wider text-[var(--color-fg-muted)] block">
                  Catalog Insights
                </span>
                <div className="grid grid-cols-2 gap-2 text-[var(--text-xs)]">
                  <div className="p-2.5 rounded bg-[var(--color-surface-sunken)]">
                    <span className="text-[var(--color-fg-muted)] block text-[10px]">Total Stock</span>
                    <strong className="text-[var(--text-sm)] font-mono text-[var(--color-fg)]">
                      {initialProduct.variants?.reduce((sum: number, v: any) => sum + (v.stock || 0), 0) || 0} units
                    </strong>
                  </div>
                  <div className="p-2.5 rounded bg-[var(--color-surface-sunken)]">
                    <span className="text-[var(--color-fg-muted)] block text-[10px]">Active SKUs</span>
                    <strong className="text-[var(--text-sm)] font-mono text-[var(--color-fg)]">
                      {initialProduct.variants?.length || 1}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ─── MODAL S6: PUBLISH CHECKLIST MODAL ────────────────────────────── */}
      <Modal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        title="Ready to Publish?"
        subtitle={`${title || "This product"} isn't ready to go live yet.`}
        maxWidth="lg"
      >
        <div className="space-y-4 py-2">
          {publishGateResult?.blockingIssues && publishGateResult.blockingIssues.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-danger)] block">
                Must Fix Before Publishing:
              </span>
              <div className="space-y-1.5 rounded-[var(--radius-md)] bg-red-50 p-3 border border-red-200">
                {publishGateResult.blockingIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setIsPublishModalOpen(false);
                      const el = document.querySelector(issue.anchor);
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-red-100/70 cursor-pointer text-[var(--text-xs)] text-red-900 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <X size={14} className="text-red-600 flex-shrink-0" />
                      {issue.message}
                    </span>
                    <span className="text-[10px] font-bold text-red-700 uppercase">Fix →</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {publishGateResult?.warnings && publishGateResult.warnings.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-warning)] block">
                Worth Fixing (Suggestions):
              </span>
              <div className="space-y-1.5 rounded-[var(--radius-md)] bg-amber-50 p-3 border border-amber-200">
                {publishGateResult.warnings.map((warn, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setIsPublishModalOpen(false);
                      const el = document.querySelector(warn.anchor);
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-amber-100/70 cursor-pointer text-[var(--text-xs)] text-amber-900 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                      {warn.message}
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 uppercase">View →</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--color-border-subtle)]">
            <button
              type="button"
              onClick={() => setIsPublishModalOpen(false)}
              className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--text-sm)] font-medium"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!publishGateResult?.canPublish}
              onClick={handlePublish}
              className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-success)] text-white text-[var(--text-sm)] font-bold disabled:opacity-40"
            >
              Publish anyway
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── CONFIRM DIALOG: CATEGORY CHANGE WARNING ───────────────────────── */}
      <ConfirmDialog
        isOpen={categoryConfirmOpen}
        onClose={() => setCategoryConfirmOpen(false)}
        onConfirm={() => {
          if (pendingCategory) applyCategoryChange(pendingCategory);
        }}
        title="Change Category?"
        message={`Changing to ${pendingCategory?.name} will clear these category-specific attribute values:\n• ${lostAttributesWarning.join(
          "\n• "
        )}\n\nShared attributes will be kept. Proceed?`}
        confirmLabel="Change Category"
        variant="warning"
      />

      {/* ─── MODAL: INLINE CREATE BRAND ───────────────────────────────────── */}
      <Modal
        isOpen={isNewBrandModalOpen}
        onClose={() => setIsNewBrandModalOpen(false)}
        title="Add New Brand"
        subtitle="Quickly register a brand for this catalog listing."
        maxWidth="sm"
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
              Brand Name
            </label>
            <input
              type="text"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="e.g. Havells, Polycab, Vaishnavi"
              className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)]"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsNewBrandModalOpen(false)}
              className="px-3 py-1.5 rounded text-[var(--text-sm)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateBrand}
              className="px-4 py-2 rounded bg-[var(--color-primary)] text-white text-[var(--text-sm)] font-bold"
            >
              Add Brand
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: EDIT IMAGE ALT TEXT ───────────────────────────────────── */}
      <Modal
        isOpen={altTextModalOpen}
        onClose={() => setAltTextModalOpen(false)}
        title="Image Accessibility & Alt Text"
        subtitle="Describe image contents for screen readers and Google image search."
        maxWidth="md"
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-[var(--text-sm)] font-semibold text-[var(--color-fg)] mb-1 block">
              Alt Text
            </label>
            <input
              type="text"
              value={editingImageAlt?.altText || ""}
              onChange={(e) =>
                setEditingImageAlt((prev) => (prev ? { ...prev, altText: e.target.value } : null))
              }
              placeholder="e.g. Red cotton kurta set with embroidered collar"
              className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] text-[var(--text-sm)]"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAltTextModalOpen(false)}
              className="px-3 py-1.5 rounded text-[var(--text-sm)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (editingImageAlt) {
                  setMediaItems((prev) =>
                    prev.map((m) => (m.id === editingImageAlt.id ? { ...m, altText: editingImageAlt.altText } : m))
                  );
                  setAltTextModalOpen(false);
                }
              }}
              className="px-4 py-2 rounded bg-[var(--color-primary)] text-white text-[var(--text-sm)] font-bold"
            >
              Save Alt Text
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
