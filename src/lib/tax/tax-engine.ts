import { getStateNameByCode } from "./indian-states";

export interface TaxCalculationParams {
  unitPrice: number; // in INR
  quantity: number;
  discountPerUnit?: number; // in INR (defaults to 0)
  hsn: {
    code: string;
    description?: string;
    rateType: "FLAT" | "SLAB" | string;
    cessRate?: number | null;
    rateVersions: Array<{
      id: string;
      gstRate?: number | null;
      effectiveFrom: Date | string;
      effectiveTo?: Date | string | null;
      slabs?: Array<{
        id?: string;
        minPrice: number;
        maxPrice?: number | null;
        gstRate: number;
      }>;
    }>;
  };
  sellerStateCode: string;
  deliveryStateCode: string;
  pricingMode?: "EXCLUSIVE" | "INCLUSIVE" | string;
  atDate?: Date | string;
}

export interface TaxCalculationResult {
  unitPrice: number;
  quantity: number;
  discountPerUnit: number;
  perUnitAfterDiscount: number;
  taxableValue: number;
  gstRate: number;
  cessRate: number;
  isIntraState: boolean;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalTax: number;
  lineTotal: number;
  rateVersionId: string;
  slabApplied?: {
    minPrice: number;
    maxPrice?: number | null;
    rate: number;
    label: string;
  } | null;
  breakdownNote: string;
}

/**
 * Standard Half-Up rounding to 2 decimal places (paisa).
 * Uses Number.EPSILON to avoid binary floating point anomalies.
 */
export function roundPaisa(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Resolves the active HSN rate version for a given date.
 */
export function resolveHsnRateVersion(
  rateVersions: TaxCalculationParams["hsn"]["rateVersions"],
  atDate: Date = new Date()
) {
  if (!rateVersions || rateVersions.length === 0) {
    throw new Error("No rate versions available for this HSN code.");
  }

  const targetTime = atDate.getTime();

  // Filter versions whose effectiveFrom <= targetTime, and effectiveTo >= targetTime (or null)
  const validVersions = rateVersions
    .map((v) => ({
      ...v,
      fromTime: new Date(v.effectiveFrom).getTime(),
      toTime: v.effectiveTo ? new Date(v.effectiveTo).getTime() : null,
    }))
    .filter((v) => v.fromTime <= targetTime && (v.toTime === null || v.toTime >= targetTime))
    .sort((a, b) => b.fromTime - a.fromTime);

  if (validVersions.length > 0) {
    return validVersions[0];
  }

  // Fallback: earliest version if all are future-dated, or latest version
  const sorted = [...rateVersions].sort(
    (a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
  );
  return sorted[0];
}

/**
 * Core GST Calculation Engine implementing TR-01 through TR-07.
 */
export function calculateTax(params: TaxCalculationParams): TaxCalculationResult {
  const {
    unitPrice,
    quantity,
    discountPerUnit = 0,
    hsn,
    sellerStateCode,
    deliveryStateCode,
    pricingMode = "EXCLUSIVE",
    atDate = new Date(),
  } = params;

  if (unitPrice < 0) throw new Error("Unit price cannot be negative.");
  if (quantity <= 0) throw new Error("Quantity must be greater than zero.");
  if (discountPerUnit < 0) throw new Error("Discount cannot be negative.");

  const dateObj = typeof atDate === "string" ? new Date(atDate) : atDate;
  const activeVersion = resolveHsnRateVersion(hsn.rateVersions, dateObj);

  // Per-unit price after discount (TR-03, TR-04)
  const perUnitAfterDiscount = Math.max(0, roundPaisa(unitPrice - discountPerUnit));
  const cessRate = hsn.cessRate ? Number(hsn.cessRate) : 0;

  // Derive GST rate from FLAT or SLAB
  let gstRate = 0;
  let slabApplied: TaxCalculationResult["slabApplied"] = null;

  if (hsn.rateType === "SLAB") {
    const slabs = activeVersion.slabs || [];
    if (slabs.length === 0) {
      throw new Error(`HSN ${hsn.code} is marked as SLAB but has no price slabs defined.`);
    }

    // Sort slabs by minPrice ascending
    const sortedSlabs = [...slabs].sort((a, b) => a.minPrice - b.minPrice);

    // Evaluate slab on per-unit taxable value (TR-03, TR-04)
    // Note: Boundary check is inclusive of upper edge:
    // e.g. minPrice 0, maxPrice 1000.00 -> 1000.00 matches 5%
    // minPrice 1000.01, maxPrice null -> 1000.01 matches 12%
    let matchedSlab = sortedSlabs.find((s) => {
      const minPass = perUnitAfterDiscount >= s.minPrice;
      const maxPass = s.maxPrice === null || s.maxPrice === undefined || perUnitAfterDiscount <= s.maxPrice;
      return minPass && maxPass;
    });

    if (!matchedSlab) {
      // If price exceeds all capped slabs and no open-ended slab, pick the highest slab
      matchedSlab = sortedSlabs[sortedSlabs.length - 1];
    }

    gstRate = matchedSlab.gstRate;
    slabApplied = {
      minPrice: matchedSlab.minPrice,
      maxPrice: matchedSlab.maxPrice ?? null,
      rate: matchedSlab.gstRate,
      label:
        matchedSlab.maxPrice !== null && matchedSlab.maxPrice !== undefined
          ? `₹${matchedSlab.minPrice.toFixed(2)} – ₹${matchedSlab.maxPrice.toFixed(2)}`
          : `Above ₹${matchedSlab.minPrice.toFixed(2)}`,
    };
  } else {
    // FLAT rate
    gstRate = activeVersion.gstRate ?? 0;
  }

  const isIntraState = sellerStateCode.padStart(2, "0") === deliveryStateCode.padStart(2, "0");
  const sellerStateName = getStateNameByCode(sellerStateCode);
  const deliveryStateName = getStateNameByCode(deliveryStateCode);

  let taxableValue = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let cessAmount = 0;
  let totalTax = 0;
  let lineTotal = 0;

  const totalTaxRate = gstRate + cessRate;

  if (pricingMode === "INCLUSIVE") {
    // TR-07: Tax-inclusive pricing: taxableValue = price * 100 / (100 + rate)
    const grossLineTotal = roundPaisa(perUnitAfterDiscount * quantity);
    taxableValue = roundPaisa((grossLineTotal * 100) / (100 + totalTaxRate));
    totalTax = roundPaisa(grossLineTotal - taxableValue);

    if (cessRate > 0) {
      cessAmount = roundPaisa((taxableValue * cessRate) / 100);
      const remainingGst = roundPaisa(totalTax - cessAmount);
      if (isIntraState) {
        cgstAmount = roundPaisa(remainingGst / 2);
        sgstAmount = roundPaisa(remainingGst - cgstAmount);
        igstAmount = 0;
      } else {
        igstAmount = remainingGst;
        cgstAmount = 0;
        sgstAmount = 0;
      }
    } else {
      if (isIntraState) {
        cgstAmount = roundPaisa(totalTax / 2);
        sgstAmount = roundPaisa(totalTax - cgstAmount);
        igstAmount = 0;
      } else {
        igstAmount = totalTax;
        cgstAmount = 0;
        sgstAmount = 0;
      }
    }

    lineTotal = grossLineTotal;
  } else {
    // Tax-exclusive pricing (default)
    // Rounding happens once at the line level, never on an intermediate (TAX-06)
    taxableValue = roundPaisa(perUnitAfterDiscount * quantity);

    if (isIntraState) {
      const halfRate = gstRate / 2;
      cgstAmount = roundPaisa((taxableValue * halfRate) / 100);
      sgstAmount = roundPaisa((taxableValue * halfRate) / 100);
      igstAmount = 0;
    } else {
      cgstAmount = 0;
      sgstAmount = 0;
      igstAmount = roundPaisa((taxableValue * gstRate) / 100);
    }

    if (cessRate > 0) {
      cessAmount = roundPaisa((taxableValue * cessRate) / 100);
    }

    totalTax = cgstAmount + sgstAmount + igstAmount + cessAmount;
    lineTotal = roundPaisa(taxableValue + totalTax);
  }

  const cgstRate = isIntraState ? gstRate / 2 : 0;
  const sgstRate = isIntraState ? gstRate / 2 : 0;
  const igstRate = !isIntraState ? gstRate : 0;

  // Compose narrative breakdown note
  let breakdownNote = "";
  if (isIntraState) {
    breakdownNote = `Delivery is inside ${sellerStateName} (intra-state), so GST splits equally as CGST (${cgstRate}%) + SGST (${sgstRate}%).`;
  } else {
    breakdownNote = `Delivery is to ${deliveryStateName} from ${sellerStateName} (inter-state), so GST applies as IGST (${igstRate}%).`;
  }

  if (slabApplied) {
    breakdownNote += ` The ${gstRate}% slab applies because the per-unit price after discount (₹${perUnitAfterDiscount.toFixed(
      2
    )}) falls in the slab ${slabApplied.label}. Taxable value is per-unit price after discount × quantity.`;
  } else {
    breakdownNote += ` A flat rate of ${gstRate}% applies to the line taxable value (₹${taxableValue.toFixed(
      2
    )}).`;
  }

  if (pricingMode === "INCLUSIVE") {
    breakdownNote += " Prices are tax-inclusive: tax is calculated as a breakdown of the price, not added on top.";
  }

  return {
    unitPrice,
    quantity,
    discountPerUnit,
    perUnitAfterDiscount,
    taxableValue,
    gstRate,
    cessRate,
    isIntraState,
    cgstRate,
    sgstRate,
    igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount,
    totalTax,
    lineTotal,
    rateVersionId: activeVersion.id,
    slabApplied,
    breakdownNote,
  };
}
