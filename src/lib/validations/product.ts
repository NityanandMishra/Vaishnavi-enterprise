import { z } from "zod";

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const variantInputSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1, "Variant title is required"),
    sku: z
      .string()
      .trim()
      .min(3, "SKU must be at least 3 characters (e.g. ORI-FAN-WHT-1200)")
      .max(60, "SKU cannot exceed 60 characters")
      .regex(
        /^[A-Za-z0-9-_]+$/,
        "SKU may only contain letters, numbers, hyphens (-), and underscores (_)"
      ),
    price: z.coerce
      .number()
      .min(0, "Price cannot be negative"),
    mrp: z.coerce
      .number()
      .min(0, "MRP cannot be negative")
      .nullable()
      .optional(),
    stock: z.coerce
      .number()
      .int("Stock count must be an integer (whole number)")
      .min(0, "Stock cannot be negative")
      .default(0),
    color: z.string().nullable().optional(),
    size: z.string().nullable().optional(),
    weightGrams: z.coerce.number().nullable().optional(),
    lengthMm: z.coerce.number().nullable().optional(),
    widthMm: z.coerce.number().nullable().optional(),
    heightMm: z.coerce.number().nullable().optional(),
    isDefault: z.boolean().default(false),
    position: z.number().default(0),
    isActive: z.boolean().default(true),
    isAvailable: z.boolean().default(true),
    attributeValues: z
      .array(
        z.object({
          attributeId: z.string().min(1, "Attribute ID is required"),
          attributeValueId: z.string().min(1, "Attribute Value ID is required"),
        })
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.mrp !== null && data.mrp !== undefined && data.mrp > 0 && data.price > 0) {
        return data.mrp >= data.price;
      }
      return true;
    },
    {
      message: "MRP (Maximum Retail Price) cannot be less than selling price",
      path: ["mrp"],
    }
  );

export const productMediaInputSchema = z.object({
  id: z.string().optional(),
  imageId: z.string().min(1, "Valid image ID is required"),
  sortOrder: z.number().default(0),
  isMain: z.boolean().default(false),
  altText: z.string().trim().max(300, "Alt text cannot exceed 300 characters").optional().nullable(),
  url: z.string().optional(),
});

export const productInputSchema = z
  .object({
    id: z.string().optional(),
    title: z
      .string()
      .trim()
      .min(3, "Product title must be at least 3 characters long")
      .max(200, "Product title cannot exceed 200 characters"),
    slug: z
      .string()
      .trim()
      .min(2, "Slug must be at least 2 characters")
      .max(220, "Slug cannot exceed 220 characters")
      .regex(slugRegex, "Slug must contain only lowercase letters, numbers, and hyphens (e.g. cotton-kurta-set)"),
    description: z
      .string()
      .trim()
      .min(10, "Please provide a description of at least 10 characters explaining product specifications"),
    shortDescription: z
      .string()
      .trim()
      .max(300, "Short description cannot exceed 300 characters")
      .optional()
      .nullable(),
    basePrice: z.coerce
      .number()
      .min(0, "Base price cannot be negative")
      .max(10000000, "Base price exceeds maximum allowable limit (₹1,00,00,000)"),
    categoryId: z
      .string()
      .trim()
      .min(1, "Please select a primary product category"),
    brandId: z.string().nullable().optional(),
    unit: z.string().trim().default("Piece"),
    hsnCode: z.string().trim().nullable().optional(),
    gstRate: z.coerce.number().nullable().optional(),
    checkoutMode: z.enum(["BUY", "INQUIRE", "DIRECT", "ENQUIRY"]).default("BUY"),
    stockMode: z.enum(["TRACKED", "UNTRACKED", "VIRTUAL", "INQUIRE"]).default("TRACKED"),
    isAvailable: z.boolean().default(true),
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("DRAFT"),
    metaTitle: z.string().trim().max(70, "Meta title cannot exceed 70 characters").optional().nullable(),
    metaDescription: z.string().trim().max(160, "Meta description cannot exceed 160 characters").optional().nullable(),
    version: z.number().int().default(1),
    specs: z.record(z.string(), z.string()).default({}),
    attributeValues: z
      .array(
        z.object({
          attributeId: z.string().min(1),
          attributeValueId: z.string().nullable().optional(),
          textValue: z.string().nullable().optional(),
          numberValue: z.coerce.number().nullable().optional(),
          boolValue: z.boolean().nullable().optional(),
        })
      )
      .optional(),
    images: z
      .array(productMediaInputSchema)
      .default([]),
    variants: z
      .array(variantInputSchema)
      .default([]),
  })
  .refine(
    (data) => {
      // Uniqueness check for SKUs within submitted variants
      const skus = data.variants
        .map((v) => v.sku?.trim().toUpperCase())
        .filter(Boolean) as string[];
      const uniqueSkus = new Set(skus);
      return uniqueSkus.size === skus.length;
    },
    {
      message: "Duplicate SKUs detected among variants. Each variant must have a unique SKU.",
      path: ["variants"],
    }
  );

// Permissive draft schema: Only title is required
export const productDraftSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Product name is required to save a draft"),
  slug: z.string().trim().optional(),
  description: z.string().optional().default(""),
  shortDescription: z.string().optional().nullable(),
  basePrice: z.coerce.number().default(0),
  categoryId: z.string().optional().default(""),
  brandId: z.string().optional().nullable(),
  unit: z.string().optional().default("Piece"),
  hsnCode: z.string().optional().nullable(),
  gstRate: z.coerce.number().optional().nullable(),
  checkoutMode: z.string().default("BUY"),
  stockMode: z.string().default("TRACKED"),
  isAvailable: z.boolean().default(true),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("DRAFT"),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  version: z.number().int().default(1),
  specs: z.record(z.string(), z.string()).default({}),
  attributeValues: z.array(z.any()).default([]),
  images: z.array(productMediaInputSchema).default([]),
  variants: z.array(z.any()).default([]),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
export type ProductMediaInput = z.infer<typeof productMediaInputSchema>;
export type ProductDraftInput = z.infer<typeof productDraftSchema>;

export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!formatted[key]) {
      formatted[key] = issue.message;
    }
  }
  return formatted;
}

// ─── PUBLISH VALIDATION GATE (FR-14 / FR-15 / FR-16) ─────────────────────────

export interface PublishGateCheck {
  field: string;
  label: string;
  passed: boolean;
  message: string;
  anchor: string;
  isWarning?: boolean;
}

export interface PublishGateResult {
  canPublish: boolean;
  checks: PublishGateCheck[];
  blockingIssues: PublishGateCheck[];
  warnings: PublishGateCheck[];
}

export interface CategoryContext {
  id?: string;
  name?: string;
  hsnCode?: string | null;
  requiredAttributeIds?: Array<{ id: string; name: string }>;
}

export function evaluatePublishGate(
  product: {
    title?: string;
    description?: string;
    categoryId?: string;
    brandId?: string | null;
    unit?: string | null;
    hsnCode?: string | null;
    metaDescription?: string | null;
    images?: Array<{ imageId?: string; altText?: string | null }>;
    variants?: Array<{
      title?: string;
      price?: number | null;
      mrp?: number | null;
      stock?: number | null;
      isActive?: boolean;
      sku?: string | null;
    }>;
    attributeValues?: Array<{
      attributeId: string;
      attributeValueId?: string | null;
      textValue?: string | null;
      numberValue?: number | null;
      boolValue?: boolean | null;
    }>;
  },
  categoryContext?: CategoryContext
): PublishGateResult {
  const checks: PublishGateCheck[] = [];

  // 1. Name Check
  const hasName = Boolean(product.title && product.title.trim().length >= 3);
  checks.push({
    field: "title",
    label: "Product Name",
    passed: hasName,
    message: hasName
      ? "Product name is set"
      : "Product name must be at least 3 characters long",
    anchor: "#section-basics",
  });

  // 2. Description Check
  const hasDesc = Boolean(product.description && product.description.trim().length >= 10);
  checks.push({
    field: "description",
    label: "Description",
    passed: hasDesc,
    message: hasDesc
      ? "Description is detailed"
      : "Detailed description is required (min 10 characters)",
    anchor: "#section-basics",
  });

  // 3. Category Check
  const hasCategory = Boolean(product.categoryId && product.categoryId.trim().length > 0);
  checks.push({
    field: "categoryId",
    label: "Category",
    passed: hasCategory,
    message: hasCategory ? "Category selected" : "A primary category is required to publish",
    anchor: "#section-organisation",
  });

  // 4. Brand Check
  const hasBrand = Boolean(product.brandId && product.brandId.trim().length > 0);
  checks.push({
    field: "brandId",
    label: "Brand",
    passed: hasBrand,
    message: hasBrand ? "Brand assigned" : "A brand is required to publish",
    anchor: "#section-organisation",
  });

  // 5. Unit Check
  const hasUnit = Boolean(product.unit && product.unit.trim().length > 0);
  checks.push({
    field: "unit",
    label: "Unit of Measurement",
    passed: hasUnit,
    message: hasUnit ? "Unit configured" : "Unit of measurement is required",
    anchor: "#section-organisation",
  });

  // 6. Media Check (>= 1 image)
  const imageCount = product.images?.length || 0;
  const hasImages = imageCount >= 1;
  checks.push({
    field: "images",
    label: "Product Photos",
    passed: hasImages,
    message: hasImages
      ? `${imageCount} image${imageCount > 1 ? "s" : ""} uploaded`
      : "At least one product photo is required to publish",
    anchor: "#section-media",
  });

  // 7. Active Variants Check (>= 1 active variant)
  const variants = product.variants || [];
  const activeVariants = variants.filter((v) => v.isActive !== false);
  const hasActiveVariants = activeVariants.length > 0;
  checks.push({
    field: "variants",
    label: "Active Variants",
    passed: hasActiveVariants,
    message: hasActiveVariants
      ? `${activeVariants.length} active variant${activeVariants.length > 1 ? "s" : ""} configured`
      : "At least one variant must be active to publish",
    anchor: "#section-variants",
  });

  // 8. Variant Pricing Check (Every active variant must have selling price > 0, price <= mrp)
  let unpricedCount = 0;
  let invalidMrpCount = 0;
  for (const v of activeVariants) {
    const p = v.price ? Number(v.price) : 0;
    const m = v.mrp ? Number(v.mrp) : 0;
    if (p <= 0) unpricedCount++;
    if (m > 0 && p > m) invalidMrpCount++;
  }

  const pricingPassed = hasActiveVariants && unpricedCount === 0 && invalidMrpCount === 0;
  let pricingMsg = "All active variants have valid prices";
  if (unpricedCount > 0) {
    pricingMsg = `${unpricedCount} active variant${unpricedCount > 1 ? "s have" : " has"} no selling price (must be > ₹0)`;
  } else if (invalidMrpCount > 0) {
    pricingMsg = `${invalidMrpCount} variant${invalidMrpCount > 1 ? "s have" : " has"} selling price exceeding MRP`;
  }

  checks.push({
    field: "variantPricing",
    label: "Variant Pricing",
    passed: pricingPassed,
    message: pricingMsg,
    anchor: "#section-variants",
  });

  // 9. Tax / HSN Check (Resolvable HSN via product override or category mapping)
  const resolvableHsn = product.hsnCode?.trim() || categoryContext?.hsnCode?.trim();
  const hasHsn = Boolean(resolvableHsn && resolvableHsn.length > 0);
  checks.push({
    field: "hsnCode",
    label: "HSN Tax Code",
    passed: hasHsn,
    message: hasHsn
      ? `HSN ${resolvableHsn} resolved`
      : `No tax code. Map an HSN for ${categoryContext?.name || "Category"} or provide an override.`,
    anchor: "#section-organisation",
  });

  // 10. Required Category Attributes Check
  if (categoryContext?.requiredAttributeIds && categoryContext.requiredAttributeIds.length > 0) {
    for (const reqAttr of categoryContext.requiredAttributeIds) {
      const valObj = product.attributeValues?.find((av) => av.attributeId === reqAttr.id);
      const isFilled = Boolean(
        valObj &&
          (valObj.attributeValueId ||
            (valObj.textValue && valObj.textValue.trim().length > 0) ||
            valObj.numberValue !== undefined ||
            valObj.boolValue !== undefined)
      );

      checks.push({
        field: `attr-${reqAttr.id}`,
        label: reqAttr.name,
        passed: isFilled,
        message: isFilled
          ? `${reqAttr.name} specified`
          : `${reqAttr.name} is required for ${categoryContext.name || "Category"}`,
        anchor: "#section-attributes",
      });
    }
  }

  // ─── WARNINGS (Worth fixing, non-blocking) ──────────────────────────────────
  const warnings: PublishGateCheck[] = [];

  // Warning A: Images missing alt text
  const missingAltCount = (product.images || []).filter((img) => !img.altText || img.altText.trim().length === 0).length;
  if (missingAltCount > 0) {
    warnings.push({
      field: "imageAlt",
      label: "Image Alt Text",
      passed: true,
      isWarning: true,
      message: `${missingAltCount} image${missingAltCount > 1 ? "s have" : " has"} no alt text (recommended for SEO)`,
      anchor: "#section-media",
    });
  }

  // Warning B: Meta description
  const hasMetaDesc = Boolean(product.metaDescription && product.metaDescription.trim().length > 0);
  if (!hasMetaDesc) {
    warnings.push({
      field: "metaDescription",
      label: "Meta Description",
      passed: true,
      isWarning: true,
      message: "No SEO meta description set (will auto-fallback to product description)",
      anchor: "#section-seo",
    });
  }

  // Warning C: Stock state (no stock on any variant)
  const totalStock = activeVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  if (totalStock === 0) {
    warnings.push({
      field: "stock",
      label: "Inventory Stock",
      passed: true,
      isWarning: true,
      message: "Zero stock on all variants — product will show as Out of Stock",
      anchor: "#section-variants",
    });
  }

  const blockingIssues = checks.filter((c) => !c.passed);
  const canPublish = blockingIssues.length === 0;

  return {
    canPublish,
    checks,
    blockingIssues,
    warnings,
  };
}
