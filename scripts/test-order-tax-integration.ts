import { prisma } from "../src/lib/db";
import { calculateTax, roundPaisa } from "../src/lib/tax/tax-engine";
import { getStateCodeByName, INDIAN_STATES } from "../src/lib/tax/indian-states";
import { placeOrder } from "../src/app/(store)/actions";

async function runOrderTaxIntegrationTests() {
  console.log("================================================================================");
  console.log("  STOREFRONT CHECKOUT & STATUTORY GST ORDER TAX INTEGRATION TEST SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAILED: ${message}`);
      failed++;
    }
  }

  // 1. Setup: Ensure user, category, brand, HSN codes, and taxSettings exist
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Test Customer",
        email: `test-${Date.now()}@example.com`,
        role: "CUSTOMER",
      },
    });
  }

  // Ensure TaxSettings exists
  let taxSettings = await prisma.taxSettings.findFirst({
    include: {
      defaultHsn: {
        include: {
          rateVersions: {
            orderBy: [{ effectiveFrom: "desc" }],
            include: { slabs: true },
          },
        },
      },
    },
  });

  if (!taxSettings) {
    let defaultHsn = await prisma.hsnCode.findFirst({ where: { code: "8536" } });
    if (!defaultHsn) {
      defaultHsn = await prisma.hsnCode.create({
        data: {
          code: "8536",
          description: "Electrical switches and connectors",
          rateType: "FLAT",
          rateVersions: {
            create: {
              gstRate: 18,
              effectiveFrom: new Date("2024-01-01"),
            },
          },
        },
      });
    }
    taxSettings = await prisma.taxSettings.create({
      data: {
        sellerStateCode: "27",
        sellerGstin: "27AABCV1234K1Z5",
        pricingMode: "EXCLUSIVE",
        defaultHsnId: defaultHsn.id,
      },
      include: {
        defaultHsn: {
          include: {
            rateVersions: {
              orderBy: [{ effectiveFrom: "desc" }],
              include: { slabs: true },
            },
          },
        },
      },
    });
  }

  console.log(`[Setup] Seller State: "${taxSettings.sellerStateCode}", Seller GSTIN: "${taxSettings.sellerGstin}"`);

  // Ensure HSN 8541 (Flat 18%) and HSN 6109 (Slab: <=1000 @ 5%, >1000 @ 12%) exist
  let hsn8541 = await prisma.hsnCode.findUnique({
    where: { code: "8541" },
    include: { rateVersions: { include: { slabs: true } } },
  });
  if (!hsn8541) {
    hsn8541 = await prisma.hsnCode.create({
      data: {
        code: "8541",
        description: "Solar cells & modules",
        rateType: "FLAT",
        rateVersions: {
          create: {
            gstRate: 18,
            effectiveFrom: new Date("2024-01-01"),
          },
        },
      },
      include: { rateVersions: { include: { slabs: true } } },
    });
  }

  let hsn6109 = await prisma.hsnCode.findUnique({
    where: { code: "6109" },
    include: { rateVersions: { include: { slabs: true } } },
  });
  if (!hsn6109) {
    hsn6109 = await prisma.hsnCode.create({
      data: {
        code: "6109",
        description: "Apparel and clothing",
        rateType: "SLAB",
        rateVersions: {
          create: {
            effectiveFrom: new Date("2024-01-01"),
            slabs: {
              create: [
                { minPrice: 0, maxPrice: 1000.0, gstRate: 5 },
                { minPrice: 1000.01, maxPrice: null, gstRate: 12 },
              ],
            },
          },
        },
      },
      include: { rateVersions: { include: { slabs: true } } },
    });
  }

  // Ensure Category exists
  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: { name: "Solar Equipment", slug: "solar-eq", description: "Solar" },
    });
  }

  // Create two test products:
  // Product A: Under HSN 8541 (Flat 18%), Price ₹2,000
  const prodA = await prisma.product.create({
    data: {
      title: "Solar Test Inverter 2kW",
      slug: `solar-inverter-test-${Date.now()}`,
      description: "Comprehensive 2kW solar hybrid inverter for home power systems.",
      basePrice: 2000,
      checkoutMode: "BUY",
      stockMode: "FINITE",
      hsnId: hsn8541.id,
      categoryId: category.id,
      status: "ACTIVE",
      variants: {
        create: {
          title: "Standard",
          sku: `SKU-INV-${Date.now()}`,
          price: 2000,
          stock: 50,
          isActive: true,
        },
      },
    },
    include: { variants: true, hsnRel: { include: { rateVersions: { include: { slabs: true } } } } },
  });

  // Product B: Under HSN 6109 (Slab: <=1000 is 5%), Price ₹800
  const prodB = await prisma.product.create({
    data: {
      title: "Solar Technician Kurta / Uniform",
      slug: `solar-uniform-test-${Date.now()}`,
      description: "Cotton uniform for solar technician field operations.",
      basePrice: 800,
      checkoutMode: "BUY",
      stockMode: "FINITE",
      hsnId: hsn6109.id,
      categoryId: category.id,
      status: "ACTIVE",
      variants: {
        create: {
          title: "Size L",
          sku: `SKU-UNI-${Date.now()}`,
          price: 800,
          stock: 50,
          isActive: true,
        },
      },
    },
    include: { variants: true, hsnRel: { include: { rateVersions: { include: { slabs: true } } } } },
  });

  console.log(`[Setup] Created Test Products: "${prodA.title}" (HSN 8541) and "${prodB.title}" (HSN 6109)`);

  // ─── TEST 1: State Code Resolution ──────────────────────────────────────────
  console.log("\n[TEST 1] Testing State Name & Abbreviation Resolution...");
  assert(getStateCodeByName("Maharashtra") === "27", "Full state name 'Maharashtra' resolves to '27'");
  assert(getStateCodeByName("MH") === "27", "Abbreviation 'MH' resolves to '27'");
  assert(getStateCodeByName("Uttar Pradesh") === "09", "Full state name 'Uttar Pradesh' resolves to '09'");
  assert(getStateCodeByName("UP") === "09", "Abbreviation 'UP' resolves to '09'");
  assert(getStateCodeByName("Karnataka") === "29", "Full state name 'Karnataka' resolves to '29'");
  assert(getStateCodeByName("27") === "27", "Numeric code '27' resolves to '27'");

  // ─── TEST 2: Intra-State Order Tax Snapshotting (Seller: 27, Buyer: 27) ──────
  console.log("\n[TEST 2] Testing Intra-State Order Placement & Tax Snapshotting...");

  // Calculate taxes directly with engine
  const taxA_intra = calculateTax({
    unitPrice: 2000,
    quantity: 1,
    hsn: hsn8541,
    sellerStateCode: "27",
    deliveryStateCode: "27",
    pricingMode: "EXCLUSIVE",
  });
  assert(taxA_intra.isIntraState === true, "Intra-state: isIntraState is true");
  assert(taxA_intra.cgstAmount === 180 && taxA_intra.sgstAmount === 180, "₹2,000 @ 18% splits into ₹180 CGST + ₹180 SGST");
  assert(taxA_intra.igstAmount === 0, "Intra-state IGST is ₹0");

  const taxB_intra = calculateTax({
    unitPrice: 800,
    quantity: 2,
    hsn: hsn6109,
    sellerStateCode: "27",
    deliveryStateCode: "27",
    pricingMode: "EXCLUSIVE",
  });
  assert(taxB_intra.gstRate === 5, "Per unit ₹800 <= ₹1,000 matches 5% slab for HSN 6109");
  assert(taxB_intra.taxableValue === 1600, "Taxable value for 2 units @ ₹800 is ₹1,600");
  assert(taxB_intra.cgstAmount === 40 && taxB_intra.sgstAmount === 40, "₹1,600 @ 5% splits into ₹40 CGST + ₹40 SGST");

  // Create simulated Order in Database with snapshot items
  const intraOrder = await prisma.order.create({
    data: {
      userId: user.id,
      status: "CONFIRMED",
      totalAmount: roundPaisa(taxA_intra.lineTotal + taxB_intra.lineTotal),
      discountAmount: 0,
      paymentMethod: "COD",
      deliveryZone: "PAN_INDIA",
      shippingAddress: JSON.stringify({
        fullName: "Ramesh Sharma",
        addressLine1: "101 Nariman Point",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400021",
        phone: "9876543210",
      }),
      items: {
        create: [
          {
            productId: prodA.id,
            variantId: prodA.variants[0].id,
            variantTitle: prodA.variants[0].title,
            quantity: 1,
            price: 2000,
            hsnCode: hsn8541.code,
            gstRate: taxA_intra.gstRate,
            cgstAmount: taxA_intra.cgstAmount,
            sgstAmount: taxA_intra.sgstAmount,
            igstAmount: taxA_intra.igstAmount,
            cessAmount: taxA_intra.cessAmount,
            taxableValue: taxA_intra.taxableValue,
          },
          {
            productId: prodB.id,
            variantId: prodB.variants[0].id,
            variantTitle: prodB.variants[0].title,
            quantity: 2,
            price: 800,
            hsnCode: hsn6109.code,
            gstRate: taxB_intra.gstRate,
            cgstAmount: taxB_intra.cgstAmount,
            sgstAmount: taxB_intra.sgstAmount,
            igstAmount: taxB_intra.igstAmount,
            cessAmount: taxB_intra.cessAmount,
            taxableValue: taxB_intra.taxableValue,
          },
        ],
      },
    },
    include: { items: true },
  });

  assert(intraOrder.items.length === 2, "Intra-state order created with 2 line items");
  assert(intraOrder.items[0].hsnCode === "8541", "Item 1 has snapshot HSN '8541'");
  assert(intraOrder.items[0].cgstAmount === 180, "Item 1 has snapshot CGST ₹180");
  assert(intraOrder.items[0].sgstAmount === 180, "Item 1 has snapshot SGST ₹180");
  assert(intraOrder.items[0].igstAmount === 0, "Item 1 has snapshot IGST ₹0");
  assert(intraOrder.items[1].hsnCode === "6109", "Item 2 has snapshot HSN '6109'");
  assert(intraOrder.items[1].gstRate === 5, "Item 2 has snapshot slab rate 5%");
  assert(intraOrder.items[1].cgstAmount === 40, "Item 2 has snapshot CGST ₹40");

  const totalIntraCgst = intraOrder.items.reduce((s, i) => s + (i.cgstAmount || 0), 0);
  const totalIntraSgst = intraOrder.items.reduce((s, i) => s + (i.sgstAmount || 0), 0);
  const totalIntraTax = totalIntraCgst + totalIntraSgst;
  assert(totalIntraCgst === 220, "Total order CGST is exactly ₹220.00 (180 + 40)");
  assert(totalIntraSgst === 220, "Total order SGST is exactly ₹220.00 (180 + 40)");
  assert(totalIntraTax === 440, "Total order GST is exactly ₹440.00");
  assert(intraOrder.totalAmount === 4040, "Order grand total is exactly ₹4,040.00 (3600 taxable + 440 tax)");

  // ─── TEST 3: Inter-State Order Tax Snapshotting (Seller: 27, Buyer: 09) ──────
  console.log("\n[TEST 3] Testing Inter-State Order Placement & Tax Snapshotting...");

  const taxA_inter = calculateTax({
    unitPrice: 2000,
    quantity: 1,
    hsn: hsn8541,
    sellerStateCode: "27",
    deliveryStateCode: "09", // Uttar Pradesh
    pricingMode: "EXCLUSIVE",
  });
  assert(taxA_inter.isIntraState === false, "Inter-state: isIntraState is false");
  assert(taxA_inter.igstAmount === 360, "₹2,000 @ 18% applies as ₹360 IGST");
  assert(taxA_inter.cgstAmount === 0 && taxA_inter.sgstAmount === 0, "Inter-state CGST & SGST are ₹0");

  const interOrder = await prisma.order.create({
    data: {
      userId: user.id,
      status: "CONFIRMED",
      totalAmount: roundPaisa(taxA_inter.lineTotal),
      discountAmount: 0,
      paymentMethod: "COD",
      deliveryZone: "UP",
      shippingAddress: JSON.stringify({
        fullName: "Virendra Mishra",
        addressLine1: "Suriyawan Market",
        city: "Suriyawan",
        state: "Uttar Pradesh",
        pincode: "221404",
        phone: "7388847575",
      }),
      items: {
        create: [
          {
            productId: prodA.id,
            variantId: prodA.variants[0].id,
            variantTitle: prodA.variants[0].title,
            quantity: 1,
            price: 2000,
            hsnCode: hsn8541.code,
            gstRate: taxA_inter.gstRate,
            cgstAmount: taxA_inter.cgstAmount,
            sgstAmount: taxA_inter.sgstAmount,
            igstAmount: taxA_inter.igstAmount,
            cessAmount: taxA_inter.cessAmount,
            taxableValue: taxA_inter.taxableValue,
          },
        ],
      },
    },
    include: { items: true },
  });

  assert(interOrder.items.length === 1, "Inter-state order created with 1 item");
  assert(interOrder.items[0].igstAmount === 360, "Item has snapshot IGST ₹360.00");
  assert(interOrder.items[0].cgstAmount === 0, "Item has snapshot CGST ₹0.00");
  assert(interOrder.items[0].sgstAmount === 0, "Item has snapshot SGST ₹0.00");
  assert(interOrder.totalAmount === 2360, "Inter-state order grand total is ₹2,360.00");

  // ─── TEST 4: Verification of Order Details Page Computation ─────────────────
  console.log("\n[TEST 4] Testing Order Details Page Computation Logic...");
  const retrievedOrder = await prisma.order.findUnique({
    where: { id: intraOrder.id },
    include: { items: true },
  });

  if (!retrievedOrder) throw new Error("Could not retrieve intraOrder");

  const subtotal = retrievedOrder.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalCgst = retrievedOrder.items.reduce((s, i) => s + (i.cgstAmount ?? 0), 0);
  const totalSgst = retrievedOrder.items.reduce((s, i) => s + (i.sgstAmount ?? 0), 0);
  const totalIgst = retrievedOrder.items.reduce((s, i) => s + (i.igstAmount ?? 0), 0);
  const totalSnapshotTax = totalCgst + totalSgst + totalIgst;
  const isIntraState = totalIgst === 0 && (totalCgst > 0 || totalSgst > 0);

  assert(subtotal === 3600, "Calculated subtotal is ₹3,600.00");
  assert(totalCgst === 220, "Calculated CGST is ₹220.00");
  assert(totalSgst === 220, "Calculated SGST is ₹220.00");
  assert(totalSnapshotTax === 440, "Calculated snapshot total tax is ₹440.00");
  assert(isIntraState === true, "Detected as Intra-State transaction");

  // ─── CLEANUP ────────────────────────────────────────────────────────────────
  console.log("\n[Cleanup] Cleaning up test orders and products...");
  await prisma.orderItem.deleteMany({ where: { orderId: { in: [intraOrder.id, interOrder.id] } } });
  await prisma.order.deleteMany({ where: { id: { in: [intraOrder.id, interOrder.id] } } });
  await prisma.productVariant.deleteMany({ where: { productId: { in: [prodA.id, prodB.id] } } });
  await prisma.product.deleteMany({ where: { id: { in: [prodA.id, prodB.id] } } });
  console.log("✓ Test records cleaned up cleanly.");

  console.log("\n================================================================================");
  console.log(`VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runOrderTaxIntegrationTests().catch((err) => {
  console.error("FATAL ERROR in test suite:", err);
  process.exit(1);
});
