import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Inventory initialization and migration...");

  // 1. Seed or find default Location
  let defaultLocation = await prisma.location.findUnique({
    where: { code: "MAIN" },
  });

  if (!defaultLocation) {
    defaultLocation = await prisma.location.create({
      data: {
        code: "MAIN",
        name: "Main Warehouse",
        isDefault: true,
        isActive: true,
      },
    });
    console.log(`[Location] Created default location: ${defaultLocation.name} (${defaultLocation.code})`);
  } else {
    console.log(`[Location] Found existing default location: ${defaultLocation.name} (${defaultLocation.code})`);
  }

  // 2. Setup SQLite database triggers to enforce append-only on InventoryMovement
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER IF NOT EXISTS trg_inventory_movement_prevent_update
      BEFORE UPDATE ON InventoryMovement
      BEGIN
        SELECT RAISE(ABORT, 'Inventory movements are immutable and cannot be updated');
      END;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER IF NOT EXISTS trg_inventory_movement_prevent_delete
      BEFORE DELETE ON InventoryMovement
      BEGIN
        SELECT RAISE(ABORT, 'Inventory movements are immutable and cannot be deleted');
      END;
    `);

    console.log("[Triggers] Append-only database triggers verified on InventoryMovement.");
  } catch (err: any) {
    console.warn("[Triggers] Warning setting triggers:", err.message);
  }

  // 3. Migrate all ProductVariants into Inventory records
  const variants = await prisma.productVariant.findMany({
    where: { deletedAt: null },
    include: {
      inventories: {
        where: { locationId: defaultLocation.id },
      },
    },
  });

  console.log(`[Sync] Scanning ${variants.length} active variants for inventory records...`);
  let createdCount = 0;

  for (const variant of variants) {
    if (variant.inventories.length === 0) {
      const initialOnHand = Math.max(0, variant.stock || 0);
      const inventory = await prisma.inventory.create({
        data: {
          variantId: variant.id,
          locationId: defaultLocation.id,
          onHand: initialOnHand,
          reserved: 0,
          lowStockThreshold: 5,
          backorderEnabled: false,
        },
      });

      if (initialOnHand > 0) {
        await prisma.inventoryMovement.create({
          data: {
            inventoryId: inventory.id,
            variantId: variant.id,
            movementType: "ADJUSTMENT",
            reasonCode: "CORRECTION",
            quantityDelta: initialOnHand,
            onHandAfter: initialOnHand,
            reservedAfter: 0,
            referenceType: "ADJUSTMENT",
            referenceId: "INITIAL_MIGRATION",
            note: "Initial stock migration from variant record",
            createdBy: "System",
          },
        });
      }

      createdCount++;
    }
  }

  console.log(`[Sync] Successfully initialized ${createdCount} new inventory records.`);
  console.log("Inventory initialization complete!");
}

main()
  .catch((e) => {
    console.error("Initialization failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
