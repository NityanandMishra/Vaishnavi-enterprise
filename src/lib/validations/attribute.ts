import { z } from "zod";

export const attributeValueInputSchema = z.object({
  id: z.string().optional(),
  attributeId: z.string().optional(),
  label: z
    .string()
    .trim()
    .min(1, "Option label is required (e.g. 'Pure White' or '1200 mm')")
    .max(80, "Option label cannot exceed 80 characters"),
  code: z
    .string()
    .trim()
    .min(1, "Option code is required (e.g. 'wht' or '1200')")
    .max(50, "Option code cannot exceed 50 characters")
    .regex(
      /^[a-z0-9_-]+$/i,
      "Code may only contain letters, numbers, hyphens (-), and underscores (_)"
    ),
  swatchHex: z
    .string()
    .trim()
    .regex(
      /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/,
      "Please enter a valid 3 or 6-digit hex color code (e.g. '#FFFFFF')"
    )
    .nullable()
    .optional()
    .or(z.literal("")),
  isDefault: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
});

export const attributeInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Attribute name must be at least 2 characters")
      .max(60, "Attribute name cannot exceed 60 characters"),
    code: z
      .string()
      .trim()
      .min(2, "Attribute code must be at least 2 characters")
      .max(50, "Attribute code cannot exceed 50 characters")
      .regex(
        /^[a-z0-9_]+$/,
        "Code must contain only lowercase letters, numbers, and underscores (e.g. 'blade_sweep')"
      ),
    inputType: z.enum(
      ["TEXT", "NUMBER", "BOOLEAN", "SINGLE_SELECT", "MULTI_SELECT"],
      {
        message: "Please select a valid input type",
      }
    ),
    isVariantDefining: z.boolean().default(false),
    usesSwatches: z.boolean().default(false),
    description: z
      .string()
      .max(250, "Description cannot exceed 250 characters")
      .nullable()
      .optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // If variant defining, input type must be SINGLE_SELECT
      if (data.isVariantDefining && data.inputType !== "SINGLE_SELECT") {
        return false;
      }
      return true;
    },
    {
      message: "Only Single Select attributes can be marked as Variant Defining",
      path: ["isVariantDefining"],
    }
  );

export const bulkValuesPasteSchema = z.object({
  rawText: z
    .string()
    .trim()
    .min(1, "Please enter or paste at least one attribute value"),
});

export type AttributeInput = z.infer<typeof attributeInputSchema>;
export type AttributeValueInput = z.infer<typeof attributeValueInputSchema>;

export function formatAttributeZodErrors(error: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!formatted[key]) {
      formatted[key] = issue.message;
    }
  }
  return formatted;
}
