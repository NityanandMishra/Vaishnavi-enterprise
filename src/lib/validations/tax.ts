import { z } from "zod";
import { validateGSTIN } from "../tax/indian-states";

export const unitTypeEnum = z.enum(["COUNT", "WEIGHT", "VOLUME", "LENGTH", "AREA"]);

export const unitInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Unit name is required (e.g. 'Kilogram' or 'Piece')")
    .max(50, "Unit name cannot exceed 50 characters"),
  symbol: z
    .string()
    .trim()
    .min(1, "Unit symbol is required (e.g. 'kg' or 'pcs')")
    .max(8, "Unit symbol cannot exceed 8 characters"),
  unitType: unitTypeEnum,
  decimalPrecision: z
    .number()
    .int("Decimal precision must be an integer")
    .min(0, "Precision cannot be less than 0")
    .max(3, "Precision cannot exceed 3 decimals"),
  isActive: z.boolean().default(true),
});

export const priceSlabInputSchema = z.object({
  id: z.string().optional(),
  minPrice: z.number().min(0, "Minimum price must be 0 or greater"),
  maxPrice: z.number().nullable().optional(),
  gstRate: z.number().min(0, "GST rate must be 0% or greater").max(100, "GST rate cannot exceed 100%"),
});

export const hsnInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d+$/, "HSN code must contain digits only")
      .refine(
        (val) => [4, 6, 8].includes(val.length),
        {
          message: "HSN code must be 4, 6 or 8 digits.",
        }
      ),
    description: z
      .string()
      .trim()
      .min(3, "Description must be at least 3 characters")
      .max(300, "Description cannot exceed 300 characters"),
    rateType: z.enum(["FLAT", "SLAB"]),
    gstRate: z
      .number()
      .min(0, "GST rate must be 0% or greater")
      .max(100, "GST rate cannot exceed 100%")
      .optional()
      .nullable(),
    cessRate: z
      .number()
      .min(0, "Cess rate must be 0% or greater")
      .max(100, "Cess rate cannot exceed 100%")
      .optional()
      .nullable()
      .default(0),
    effectiveFrom: z
      .string()
      .min(1, "Effective from date is required")
      .or(z.date()),
    isActive: z.boolean().default(true),
    slabs: z.array(priceSlabInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rateType === "FLAT") {
      if (data.gstRate === undefined || data.gstRate === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GST rate is required for flat rate HSN codes",
          path: ["gstRate"],
        });
      }
    } else if (data.rateType === "SLAB") {
      const slabs = data.slabs || [];
      if (slabs.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Price slab HSN must have at least 2 slabs",
          path: ["slabs"],
        });
        return;
      }

      // Check last slab is open-ended
      const lastSlab = slabs[slabs.length - 1];
      if (lastSlab.maxPrice !== null && lastSlab.maxPrice !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "The last slab must have no upper limit, so every price is covered",
          path: ["slabs", slabs.length - 1, "maxPrice"],
        });
      }

      // Check continuity
      for (let i = 0; i < slabs.length - 1; i++) {
        const curr = slabs[i];
        const next = slabs[i + 1];
        if (curr.maxPrice === null || curr.maxPrice === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Only the final slab can have an unlimited upper bound",
            path: ["slabs", i, "maxPrice"],
          });
        } else if (curr.maxPrice <= curr.minPrice) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Slab upper bound must be greater than lower bound",
            path: ["slabs", i, "maxPrice"],
          });
        }
      }
    }
  });

export const rateVersionInputSchema = z
  .object({
    rateType: z.enum(["FLAT", "SLAB"]).default("FLAT"),
    gstRate: z.number().min(0).max(100).optional().nullable(),
    effectiveFrom: z.string().or(z.date()),
    slabs: z.array(priceSlabInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rateType === "FLAT" && (data.gstRate === undefined || data.gstRate === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GST rate is required for flat rate version",
        path: ["gstRate"],
      });
    }
    if (data.rateType === "SLAB") {
      const slabs = data.slabs || [];
      if (slabs.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Price slab HSN must have at least 2 slabs",
          path: ["slabs"],
        });
      } else {
        const lastSlab = slabs[slabs.length - 1];
        if (lastSlab.maxPrice !== null && lastSlab.maxPrice !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "The last slab must have no upper limit, so every price is covered",
            path: ["slabs", slabs.length - 1, "maxPrice"],
          });
        }
      }
    }
  });

export const taxSettingsInputSchema = z
  .object({
    sellerStateCode: z.string().min(2).max(2),
    sellerGstin: z.string().trim().toUpperCase(),
    pricingMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]),
    defaultHsnId: z.string().nullable().optional(),
    confirmationToken: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const gstinCheck = validateGSTIN(data.sellerGstin);
    if (!gstinCheck.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: gstinCheck.error || "Invalid GSTIN",
        path: ["sellerGstin"],
      });
    }
  });

export const categoryHsnMappingSchema = z.object({
  categoryId: z.string().min(1, "Category ID is required"),
  hsnId: z.string().min(1, "HSN ID is required"),
});

export const bulkCategoryHsnSchema = z.object({
  categoryIds: z.array(z.string().min(1)).min(1, "Select at least one category"),
  hsnId: z.string().min(1, "HSN ID is required"),
});

export const taxPreviewInputSchema = z.object({
  price: z.number().min(0, "Price cannot be negative"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  discount: z.number().min(0, "Discount cannot be negative").default(0),
  hsnId: z.string().min(1, "HSN code is required"),
  deliveryStateCode: z.string().min(2, "Delivery state code is required"),
});

export type UnitInput = z.infer<typeof unitInputSchema>;
export type HsnInput = z.infer<typeof hsnInputSchema>;
export type RateVersionInput = z.infer<typeof rateVersionInputSchema>;
export type TaxSettingsInput = z.infer<typeof taxSettingsInputSchema>;
export type CategoryHsnMappingInput = z.infer<typeof categoryHsnMappingSchema>;
export type TaxPreviewInput = z.infer<typeof taxPreviewInputSchema>;
