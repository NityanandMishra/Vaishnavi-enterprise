import { z } from "zod";

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
      .min(0, "Stock cannot be negative"),
    color: z.string().nullable().optional(),
    size: z.string().nullable().optional(),
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
      if (data.mrp !== null && data.mrp !== undefined && data.mrp > 0) {
        return data.mrp >= data.price;
      }
      return true;
    },
    {
      message: "MRP (Maximum Retail Price) cannot be less than selling price",
      path: ["mrp"],
    }
  );

export const productInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Product title must be at least 3 characters long")
      .max(200, "Product title cannot exceed 200 characters"),
    description: z
      .string()
      .trim()
      .min(10, "Please provide a description of at least 10 characters explaining product specifications"),
    basePrice: z.coerce
      .number()
      .positive("Base price must be greater than ₹0")
      .max(10000000, "Base price exceeds maximum allowable limit (₹1,00,00,000)"),
    categoryId: z
      .string()
      .trim()
      .min(1, "Please select a primary product category"),
    brandId: z.string().nullable().optional(),
    checkoutMode: z.enum(["BUY", "INQUIRE", "DIRECT", "ENQUIRY"], {
      message: "Please select a valid checkout mode",
    }),
    stockMode: z.enum(["TRACKED", "UNTRACKED", "VIRTUAL", "INQUIRE"], {
      message: "Please select a valid stock mode",
    }),
    isAvailable: z.boolean().default(true),
    specs: z.record(z.string(), z.string()).default({}),
    images: z
      .array(
        z.object({
          imageId: z.string().min(1, "Valid image ID is required"),
          sortOrder: z.number().default(0),
          isMain: z.boolean().default(false),
        })
      )
      .min(1, "At least one product image is required. Please select or upload a photo from the Media Library."),
    variants: z
      .array(variantInputSchema)
      .min(1, "At least one variant or SKU must be configured for this product"),
  })
  .refine(
    (data) => {
      // Uniqueness check for SKUs within the submitted variants
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

export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;

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
