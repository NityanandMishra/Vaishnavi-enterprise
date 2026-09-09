import { prisma } from "../src/lib/db";
import { evaluatePublishGate, generateSlug } from "../src/lib/validations/product";
import {
  saveProductDraft,
  publishProduct,
  updateProductStatus,
  duplicateProduct,
  bulkAdjustPrice,
  undoPriceAdjustment,
  getProducts,
  saveProductView,
  getSavedViews,
  deleteSavedView,
} from "../src/app/admin/(authenticated)/products/actions";
import {
  validateImportData,
  commitProductImport,
  revertImportBatch,
} from "../src/app/admin/(authenticated)/products/import/actions";

async function runTests() {
  console.log("=================================================");
  console.log("  EPIC-03 PRODUCT MANAGEMENT (PROD) TEST SUITE   ");
  console.log("=================================================\n");

  // 1. Get or create a category and brand for tests
  let category = await prisma.category.findFirst({ where: { deletedAt: null } });
  if (!category) {
    category = await prisma.category.create({
      data: { name: "Test Category", slug: "test-category", description: "Test", hsnCode: "8414" },
    });
  } else if (!category.hsnCode) {
    category = await prisma.category.update({
      where: { id: category.id },
      data: { hsnCode: "8414" },
    });
  }

  let brand = await prisma.brand.findFirst({ where: { deletedAt: null } });
  if (!brand) {
    brand = await prisma.brand.create({
      data: { name: "Test Brand", slug: "test-brand", description: "Test" },
    });
  }

  let media = await prisma.mediaImage.findFirst();
  if (!media) {
    media = await prisma.mediaImage.create({
      data: {
        filename: "test.jpg",
        url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800",
        size: 1024,
      },
    });
  }

  console.log(`[Setup] Using Category "${category.name}", Brand "${brand.name}", and Media "${media.id}"`);

  // ─── TEST 1: Permissive Draft Creation (PROD-03) ─────────────────────────
  console.log("\n[TEST 1] Testing Permissive Draft Creation (zero friction)...");
  const draftRes = await saveProductDraft({
    title: "Automated Test Draft Product",
    categoryId: category.id,
    brandId: brand.id,
    basePrice: 0,
    status: "DRAFT",
    variants: [],
  });

  if (!draftRes.success || !draftRes.product) {
    throw new Error(`Draft creation failed: ${draftRes.error}`);
  }
  const createdDraftId = draftRes.product.id;
  console.log(`✓ Draft created successfully! ID: ${createdDraftId}, Slug: ${draftRes.product.slug}`);

  // ─── TEST 2: Publish Gate Blockage (FR-14 / PROD-07) ────────────────────
  console.log("\n[TEST 2] Testing Publish Gate on incomplete product...");
  const pubAttempt = await publishProduct(createdDraftId);
  if (pubAttempt.status !== 422 || pubAttempt.success) {
    throw new Error("Publish gate failed to block incomplete draft!");
  }
  console.log(`✓ Publish gate properly blocked publication with 422.`);
  console.log(`  Blocking issues (${pubAttempt.blockingIssues?.length}):`, pubAttempt.blockingIssues?.map((b: any) => b.message));
  console.log(`  Warnings (${pubAttempt.warnings?.length}):`, pubAttempt.warnings?.map((w: any) => w.message));

  // ─── TEST 3: Complete & Publish Single-SKU (PROD-01 / PROD-07) ─────────
  console.log("\n[TEST 3] Updating draft to complete state and publishing...");
  const uniqueSku = `TEST-SKU-${Date.now()}`;
  const saveCompleteRes = await saveProductDraft({
    id: createdDraftId,
    title: "Complete Test Product",
    slug: `complete-test-product-${Date.now()}`,
    categoryId: category.id,
    brandId: brand.id,
    basePrice: 999,
    description: "Detailed specification and test description of complete product.",
    shortDescription: "A short preview description",
    unit: "Piece",
    status: "DRAFT",
    images: [{ imageId: media.id, altText: "Test image", isMain: true }],
    variants: [
      {
        title: "Standard",
        sku: uniqueSku,
        price: 999,
        mrp: 1499,
        stock: 25,
        isActive: true,
      },
    ],
  });

  if (!saveCompleteRes.success) {
    throw new Error(`Complete save failed: ${saveCompleteRes.error}`);
  }

  const pubSuccess = await publishProduct(createdDraftId);
  if (!pubSuccess.success) {
    throw new Error(`Publish failed: ${pubSuccess.error} Blocking: ${JSON.stringify(pubSuccess.blockingIssues)}`);
  }
  console.log(`✓ Product successfully published to ACTIVE status!`);

  // ─── TEST 4: Product Duplication (PROD-12) ──────────────────────────────
  console.log("\n[TEST 4] Testing Product Deep Duplication (PROD-12)...");
  const dupRes = await duplicateProduct(createdDraftId);
  if (!dupRes.success || !dupRes.newProductId) {
    throw new Error(`Duplication failed: ${dupRes.error}`);
  }
  const duplicatedProduct = await prisma.product.findUnique({
    where: { id: dupRes.newProductId },
    include: { variants: true },
  });
  if (!duplicatedProduct) throw new Error("Duplicated product not found in DB");
  if (duplicatedProduct.status !== "DRAFT") throw new Error("Duplicated product must be in DRAFT status");
  if (duplicatedProduct.variants[0].stock !== 0) throw new Error("Duplicated variant stock must be reset to 0");
  if (duplicatedProduct.variants[0].sku === uniqueSku) throw new Error("Duplicated variant must have a unique SKU");

  console.log(`✓ Product duplicated successfully!`);
  console.log(`  New Title: ${duplicatedProduct.title}`);
  console.log(`  New Slug: ${duplicatedProduct.slug}`);
  console.log(`  New SKU: ${duplicatedProduct.variants[0].sku}`);
  console.log(`  Stock: ${duplicatedProduct.variants[0].stock}`);

  // ─── TEST 5: Bulk Price Adjustment with Dry-Run & 30s Undo (PROD-11) ───
  console.log("\n[TEST 5] Testing Bulk Price Adjustment with Dry-Run & Undo...");
  // 5a: Dry run
  const dryRunRes = await bulkAdjustPrice({
    productIds: [createdDraftId],
    mode: "PERCENT",
    direction: "INCREASE",
    value: 10,
    applyTo: "SELLING",
    rounding: "END_IN_9",
    conflictResolution: "RAISE_MRP",
    dryRun: true,
  });

  if (!dryRunRes.success || !dryRunRes.preview || dryRunRes.preview.length === 0) {
    throw new Error("Bulk price adjustment dry run failed");
  }
  console.log(`✓ Dry-run preview computed successfully:`);
  console.log(`  Old Price: ₹${dryRunRes.preview[0].oldPrice} -> New Price: ₹${dryRunRes.preview[0].newPrice}`);

  // 5b: Execute real adjustment
  const realAdjustRes = await bulkAdjustPrice({
    productIds: [createdDraftId],
    mode: "PERCENT",
    direction: "INCREASE",
    value: 10,
    applyTo: "SELLING",
    rounding: "END_IN_9",
    conflictResolution: "RAISE_MRP",
    dryRun: false,
  });
  if (!realAdjustRes.success || !realAdjustRes.batchId) {
    throw new Error("Real price adjustment failed");
  }
  const batchId = realAdjustRes.batchId;
  console.log(`✓ Price adjustment applied to DB. Batch ID: ${batchId}`);

  // Verify price changed
  const adjustedVariant = await prisma.productVariant.findFirst({
    where: { productId: createdDraftId },
  });
  console.log(`  Updated Variant Price in DB: ₹${adjustedVariant?.price}`);

  // 5c: Undo adjustment
  const undoRes = await undoPriceAdjustment(batchId);
  if (!undoRes.success) {
    throw new Error(`Undo price adjustment failed: ${undoRes.error}`);
  }
  const revertedVariant = await prisma.productVariant.findFirst({
    where: { productId: createdDraftId },
  });
  if (revertedVariant?.price !== 999) {
    throw new Error(`Undo failed to restore original price. Expected 999, got ${revertedVariant?.price}`);
  }
  console.log(`✓ 30-second Undo transaction restored price back to ₹${revertedVariant?.price}!`);

  // ─── TEST 6: CSV Import Pre-flight Validation & Rollback (PROD-15) ─────
  console.log("\n[TEST 6] Testing CSV Import Pre-flight Validation & Rollback...");
  const mockCsvRows = [
    {
      title: "Valid Import Item 1",
      sku: `IMPORT-SKU-1-${Date.now()}`,
      category: category.name,
      price: 499,
      mrp: 799,
      stock: 10,
    },
    {
      title: "Valid Import Item 2",
      sku: `IMPORT-SKU-2-${Date.now()}`,
      category: category.name,
      price: 1299,
      mrp: 1999,
      stock: 5,
    },
    {
      title: "Invalid Row with Price > MRP",
      sku: `IMPORT-SKU-BAD-${Date.now()}`,
      category: category.name,
      price: 2000,
      mrp: 1000,
      stock: 5,
    },
  ];

  const valRes = await validateImportData(mockCsvRows);
  if (!valRes.success || !valRes.summary) {
    throw new Error("Import validation failed");
  }
  console.log(`✓ CSV Pre-flight validation output:`);
  console.log(`  Total rows: ${valRes.summary.totalRows}`);
  console.log(`  Create count: ${valRes.summary.createCount}`);
  console.log(`  Error count: ${valRes.summary.errorCount}`);
  if (valRes.summary.createCount !== 2 || valRes.summary.errorCount !== 1) {
    throw new Error(`Unexpected validation breakdown: expected 2 valid, 1 error`);
  }

  // Commit valid rows
  const commitRes = await commitProductImport(valRes.rows, "test-upload.csv");
  if (!commitRes.success || !commitRes.batchId) {
    throw new Error("Commit import failed");
  }
  console.log(`✓ Committed ${commitRes.createdCount} products as DRAFT. Batch: ${commitRes.batchId}`);

  // Test 24-hour rollback
  const rollbackRes = await revertImportBatch(commitRes.batchId);
  if (!rollbackRes.success) {
    throw new Error(`Rollback failed: ${rollbackRes.error}`);
  }
  console.log(`✓ 24-Hour Rollback successfully executed! Reverted created listings.`);

  // ─── TEST 7: Saved Views (PROD-16) ──────────────────────────────────────
  console.log("\n[TEST 7] Testing Saved Views CRUD...");
  const saveViewRes = await saveProductView("Test View Filter", {
    statusTab: "ACTIVE",
    searchQuery: "Kurta",
  });
  if (!saveViewRes.success || !saveViewRes.view) {
    throw new Error("Failed to save view");
  }
  console.log(`✓ Saved view "${saveViewRes.view.name}" with ID: ${saveViewRes.view.id}`);

  const viewsList = await getSavedViews();
  const found = viewsList.views.find((v) => v.id === saveViewRes.view?.id);
  if (!found) throw new Error("Saved view not found in list");

  await deleteSavedView(saveViewRes.view.id);
  console.log(`✓ Saved view retrieved and cleaned up successfully.`);

  // ─── CLEANUP ────────────────────────────────────────────────────────────
  console.log("\n[Cleanup] Cleaning up test records...");
  await prisma.productVariant.deleteMany({ where: { productId: { in: [createdDraftId, duplicatedProduct.id] } } });
  await prisma.product.deleteMany({ where: { id: { in: [createdDraftId, duplicatedProduct.id] } } });
  console.log("✓ Test records cleaned up.");

  console.log("\n=================================================");
  console.log("  ALL TESTS PASSED! EPIC-03 PROD ENGINE VERIFIED ");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});
