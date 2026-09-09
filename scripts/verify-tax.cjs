const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    failedTests++;
  }
}

// Replicate pure calculation engine to test in isolation
function roundPaisa(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function calculateTax({
  unitPrice,
  quantity,
  discountPerUnit = 0,
  hsn,
  sellerStateCode,
  deliveryStateCode,
  pricingMode = "EXCLUSIVE",
  atDate = new Date(),
}) {
  const dateObj = typeof atDate === "string" ? new Date(atDate) : atDate;
  const targetTime = dateObj.getTime();

  // Rate version resolution
  const versions = hsn.rateVersions
    .map((v) => ({
      ...v,
      fromTime: new Date(v.effectiveFrom).getTime(),
      toTime: v.effectiveTo ? new Date(v.effectiveTo).getTime() : null,
    }))
    .filter((v) => v.fromTime <= targetTime && (v.toTime === null || v.toTime >= targetTime))
    .sort((a, b) => b.fromTime - a.fromTime);

  const activeVersion = versions.length > 0 ? versions[0] : hsn.rateVersions[0];

  const perUnitAfterDiscount = Math.max(0, roundPaisa(unitPrice - discountPerUnit));
  const cessRate = hsn.cessRate ? Number(hsn.cessRate) : 0;

  let gstRate = 0;
  let slabApplied = null;

  if (hsn.rateType === "SLAB") {
    const slabs = [...(activeVersion.slabs || [])].sort((a, b) => a.minPrice - b.minPrice);
    const matchedSlab =
      slabs.find((s) => {
        const minPass = perUnitAfterDiscount >= s.minPrice;
        const maxPass = s.maxPrice === null || s.maxPrice === undefined || perUnitAfterDiscount <= s.maxPrice;
        return minPass && maxPass;
      }) || slabs[slabs.length - 1];

    gstRate = matchedSlab.gstRate;
    slabApplied = {
      minPrice: matchedSlab.minPrice,
      maxPrice: matchedSlab.maxPrice,
      rate: matchedSlab.gstRate,
      label:
        matchedSlab.maxPrice !== null && matchedSlab.maxPrice !== undefined
          ? `₹${matchedSlab.minPrice.toFixed(2)} – ₹${matchedSlab.maxPrice.toFixed(2)}`
          : `Above ₹${matchedSlab.minPrice.toFixed(2)}`,
    };
  } else {
    gstRate = activeVersion.gstRate ?? 0;
  }

  const isIntraState = sellerStateCode.padStart(2, "0") === deliveryStateCode.padStart(2, "0");

  let taxableValue = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let cessAmount = 0;
  let totalTax = 0;
  let lineTotal = 0;

  const totalTaxRate = gstRate + cessRate;

  if (pricingMode === "INCLUSIVE") {
    const grossLineTotal = roundPaisa(perUnitAfterDiscount * quantity);
    taxableValue = roundPaisa((grossLineTotal * 100) / (100 + totalTaxRate));
    totalTax = roundPaisa(grossLineTotal - taxableValue);

    if (cessRate > 0) {
      cessAmount = roundPaisa((taxableValue * cessRate) / 100);
      const remainingGst = roundPaisa(totalTax - cessAmount);
      if (isIntraState) {
        cgstAmount = roundPaisa(remainingGst / 2);
        sgstAmount = roundPaisa(remainingGst - cgstAmount);
      } else {
        igstAmount = remainingGst;
      }
    } else {
      if (isIntraState) {
        cgstAmount = roundPaisa(totalTax / 2);
        sgstAmount = roundPaisa(totalTax - cgstAmount);
      } else {
        igstAmount = totalTax;
      }
    }
    lineTotal = grossLineTotal;
  } else {
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

  return {
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
    slabApplied,
  };
}

function validateGSTIN(gstin) {
  const trimmed = gstin.trim().toUpperCase();
  if (trimmed.length !== 15) {
    return { isValid: false, error: "That does not look like a valid GSTIN. Expected 15 characters." };
  }
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(trimmed)) {
    return { isValid: false, error: "Invalid GSTIN format." };
  }
  return { isValid: true };
}

async function runVerification() {
  console.log("================================================================================");
  console.log("MODULE 02: UNIT & TAX / HSN MANAGEMENT (EPIC-02) — COMPREHENSIVE VERIFICATION");
  console.log("================================================================================\n");

  // ── TEST SUITE 1: DOMAIN RULES (TR-01 TO TR-07) ──────────────────────────────
  console.log("SUITE 1: GST Domain Rules & Mathematical Accuracy");

  const mockFlatHsn = {
    code: "8517",
    description: "Telephones, mobiles",
    rateType: "FLAT",
    cessRate: 0,
    rateVersions: [
      {
        id: "v1",
        gstRate: 12.0,
        effectiveFrom: new Date("2024-01-01"),
        effectiveTo: null,
      },
    ],
  };

  // TR-01 & TR-02: Intra-State Split
  const intraResult = calculateTax({
    unitPrice: 1000,
    quantity: 1,
    discountPerUnit: 0,
    hsn: mockFlatHsn,
    sellerStateCode: "27", // Maharashtra
    deliveryStateCode: "27", // Maharashtra
    pricingMode: "EXCLUSIVE",
  });
  assert(intraResult.isIntraState === true, "TR-01: Seller State 27 == Delivery State 27 is Intra-State");
  assert(intraResult.cgstRate === 6 && intraResult.sgstRate === 6, "TR-01: 12% splits into 6% CGST and 6% SGST");
  assert(intraResult.cgstAmount === 60.0 && intraResult.sgstAmount === 60.0, "TR-01: CGST and SGST are each ₹60.00");
  assert(intraResult.igstAmount === 0, "TR-01: IGST is ₹0 for intra-state");
  assert(intraResult.lineTotal === 1120.0, "TR-02: Intra-state line total is ₹1,120.00");

  // TR-01 & TR-02: Inter-State Split
  const interResult = calculateTax({
    unitPrice: 1000,
    quantity: 1,
    discountPerUnit: 0,
    hsn: mockFlatHsn,
    sellerStateCode: "27", // Maharashtra
    deliveryStateCode: "29", // Karnataka
    pricingMode: "EXCLUSIVE",
  });
  assert(interResult.isIntraState === false, "TR-01: Seller State 27 != Delivery State 29 is Inter-State");
  assert(interResult.igstRate === 12, "TR-01: IGST rate is full 12%");
  assert(interResult.igstAmount === 120.0, "TR-01: IGST is ₹120.00");
  assert(interResult.cgstAmount === 0 && interResult.sgstAmount === 0, "TR-01: CGST and SGST are ₹0 for inter-state");
  assert(interResult.totalTax === intraResult.totalTax, "TR-02: Total tax is identical intra vs inter-state (₹120.00)");
  assert(interResult.lineTotal === 1120.0, "TR-02: Inter-state line total is ₹1,120.00");

  // TR-03 & TR-04: Price Slabs for Apparel (HSN 6109)
  const mockSlabHsn = {
    code: "6109",
    description: "T-shirts",
    rateType: "SLAB",
    cessRate: 0,
    rateVersions: [
      {
        id: "v_slab",
        effectiveFrom: new Date("2024-01-01"),
        effectiveTo: null,
        slabs: [
          { minPrice: 0.0, maxPrice: 1000.0, gstRate: 5.0 },
          { minPrice: 1000.01, maxPrice: null, gstRate: 12.0 },
        ],
      },
    ],
  };

  // Slab boundary at exactly ₹1,000.00
  const slabAt1000 = calculateTax({
    unitPrice: 1000.0,
    quantity: 1,
    hsn: mockSlabHsn,
    sellerStateCode: "27",
    deliveryStateCode: "27",
  });
  assert(slabAt1000.gstRate === 5.0, "TR-03: Per-unit price exactly ₹1,000.00 applies 5% slab");
  assert(slabAt1000.cgstAmount === 25.0 && slabAt1000.sgstAmount === 25.0, "TR-03: ₹1,000 @ 5% = ₹25 CGST + ₹25 SGST");

  // Slab boundary at ₹1,000.01
  const slabAt1000_01 = calculateTax({
    unitPrice: 1000.01,
    quantity: 1,
    hsn: mockSlabHsn,
    sellerStateCode: "27",
    deliveryStateCode: "27",
  });
  assert(slabAt1000_01.gstRate === 12.0, "TR-03: Per-unit price ₹1,000.01 applies 12% slab");

  // TR-04: Per-unit price after discount picks the slab
  const slabDiscountTest = calculateTax({
    unitPrice: 1050.0,
    discountPerUnit: 100.0, // net 950.00
    quantity: 3, // line total ₹2,850
    hsn: mockSlabHsn,
    sellerStateCode: "27",
    deliveryStateCode: "27",
  });
  assert(slabDiscountTest.perUnitAfterDiscount === 950.0, "TR-04: Per-unit after discount is ₹950.00");
  assert(slabDiscountTest.gstRate === 5.0, "TR-04: Net ₹950 is <= ₹1,000, so 5% slab applies despite ₹2,850 line total");
  assert(slabDiscountTest.taxableValue === 2850.0, "TR-04: Line taxable value is 3 × ₹950 = ₹2,850.00");
  assert(slabDiscountTest.totalTax === 142.5, "TR-04: Total tax is ₹142.50 (5% of ₹2,850)");

  // PRD Preview Scenario (TAX-08 / B.4):
  // Price 1299, Qty 2, Discount 100, HSN 6109, Delivery Maharashtra
  const previewScenario = calculateTax({
    unitPrice: 1299.0,
    quantity: 2,
    discountPerUnit: 100.0,
    hsn: mockSlabHsn,
    sellerStateCode: "27",
    deliveryStateCode: "27",
  });
  assert(previewScenario.perUnitAfterDiscount === 1199.0, "TAX-08 Scenario: Per-unit after discount is ₹1,199.00");
  assert(previewScenario.taxableValue === 2398.0, "TAX-08 Scenario: Taxable value is ₹2,398.00");
  assert(previewScenario.gstRate === 12.0, "TAX-08 Scenario: 12% slab applies (above ₹1,000)");
  assert(previewScenario.cgstAmount === 143.88, "TAX-08 Scenario: CGST @ 6% is exactly ₹143.88");
  assert(previewScenario.sgstAmount === 143.88, "TAX-08 Scenario: SGST @ 6% is exactly ₹143.88");
  assert(previewScenario.lineTotal === 2685.76, "TAX-08 Scenario: Line total is exactly ₹2,685.76");

  // TR-06: Per-line Rounding, Half-Up to the paisa
  const roundTest1 = calculateTax({
    unitPrice: 333.33,
    quantity: 1,
    hsn: {
      code: "8517",
      rateType: "FLAT",
      rateVersions: [{ id: "v1", gstRate: 18.0, effectiveFrom: new Date("2024-01-01") }],
    },
    sellerStateCode: "27",
    deliveryStateCode: "29", // IGST
  });
  assert(roundTest1.igstAmount === 60.0, "TR-06: Taxable ₹333.33 @ 18% unrounded 59.9994 rounds half-up to ₹60.00");

  const roundTest2 = calculateTax({
    unitPrice: 333.30,
    quantity: 1,
    hsn: {
      code: "8517",
      rateType: "FLAT",
      rateVersions: [{ id: "v1", gstRate: 18.0, effectiveFrom: new Date("2024-01-01") }],
    },
    sellerStateCode: "27",
    deliveryStateCode: "29", // IGST
  });
  assert(roundTest2.igstAmount === 59.99, "TR-06: Taxable ₹333.30 @ 18% unrounded 59.994 rounds half-up to ₹59.99");

  const roundLineTest = calculateTax({
    unitPrice: 333.33,
    quantity: 3,
    hsn: {
      code: "8517",
      rateType: "FLAT",
      rateVersions: [{ id: "v1", gstRate: 18.0, effectiveFrom: new Date("2024-01-01") }],
    },
    sellerStateCode: "27",
    deliveryStateCode: "29",
  });
  assert(roundLineTest.taxableValue === 999.99, "TR-06: Line taxable value is ₹999.99");
  assert(roundLineTest.igstAmount === 180.0, "TR-06: Rate applied once to line (999.99 × 0.18 = 179.9982) rounds to ₹180.00");

  // TR-07: Tax-Inclusive Pricing Derivation
  const inclusiveTest = calculateTax({
    unitPrice: 1120.0,
    quantity: 1,
    hsn: mockFlatHsn, // 12%
    sellerStateCode: "27",
    deliveryStateCode: "27",
    pricingMode: "INCLUSIVE",
  });
  assert(inclusiveTest.taxableValue === 1000.0, "TR-07: Tax-inclusive ₹1,120 at 12% derives taxable value ₹1,000.00");
  assert(inclusiveTest.totalTax === 120.0, "TR-07: Total tax is ₹120.00");
  assert(inclusiveTest.lineTotal === 1120.0, "TR-07: Customer line total remains ₹1,120.00 (tax not added on top)");

  // ── TEST SUITE 2: GSTIN & HSN VALIDATION ─────────────────────────────────────
  console.log("\nSUITE 2: GSTIN Validation");

  const validGstin = validateGSTIN("27AABCV1234K1Z5");
  assert(validGstin.isValid === true, "GSTIN: '27AABCV1234K1Z5' is valid");

  const shortGstin = validateGSTIN("27AABCV1234K1");
  assert(
    shortGstin.isValid === false && shortGstin.error.includes("Expected 15 characters"),
    "GSTIN: 13-char input rejected with 'Expected 15 characters'"
  );

  // ── TEST SUITE 3: DATABASE SEED & PERSISTENCE ────────────────────────────────
  console.log("\nSUITE 3: Database Records & Master Data Verification");

  const units = await prisma.unit.findMany({ where: { deletedAt: null } });
  assert(units.length === 12, `DATABASE: All 12 default units are seeded (found ${units.length})`);

  const piece = units.find((u) => u.name === "Piece");
  assert(piece && piece.decimalPrecision === 0, "DATABASE: 'Piece' has decimal precision 0");
  assert(piece && piece.isSystem === true, "DATABASE: 'Piece' is marked isSystem = true");

  const kg = units.find((u) => u.name === "Kilogram");
  assert(kg && kg.decimalPrecision === 3 && kg.unitType === "WEIGHT", "DATABASE: 'Kilogram' has precision 3 and type WEIGHT");

  const hsnCodes = await prisma.hsnCode.findMany({
    where: { deletedAt: null },
    include: { rateVersions: { include: { slabs: true } } },
  });
  assert(hsnCodes.length >= 10, `DATABASE: Seeded at least 10 HSN codes (found ${hsnCodes.length})`);

  const hsn6109 = hsnCodes.find((h) => h.code === "6109");
  assert(hsn6109 && hsn6109.rateType === "SLAB", "DATABASE: HSN 6109 is type SLAB");
  assert(
    hsn6109 && hsn6109.rateVersions[0]?.slabs.length === 2,
    "DATABASE: HSN 6109 has 2 contiguous price slabs"
  );

  const taxSettings = await prisma.taxSettings.findFirst();
  assert(taxSettings !== null, "DATABASE: TaxSettings singleton exists");
  assert(taxSettings?.sellerStateCode === "27", "DATABASE: Default seller state is '27' (Maharashtra)");
  assert(taxSettings?.sellerGstin === "27AABCV1234K1Z5", "DATABASE: Default GSTIN is '27AABCV1234K1Z5'");

  const categoryMappings = await prisma.categoryHsnMapping.findMany();
  assert(categoryMappings.length === 9, `DATABASE: Confirmed 9 categories mapped to HSN (found ${categoryMappings.length})`);

  // Summary
  console.log("\n================================================================================");
  console.log(`VERIFICATION SUMMARY: ${passedTests} passed, ${failedTests} failed`);
  console.log("================================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification()
  .catch((e) => {
    console.error("Verification script error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
