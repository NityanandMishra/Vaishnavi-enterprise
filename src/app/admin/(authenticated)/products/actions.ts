"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  productInputSchema,
  productDraftSchema,
  formatZodErrors,
  evaluatePublishGate,
  generateSlug,
  PublishGateResult,
} from "@/lib/validations/product";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Gracefully ignore when called outside Next.js request lifecycle
  }
}

// ─── GET PRODUCTS (PAGINATED, FILTERED, SEARCHABLE) ──────────────────────────

export interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "ALL" | "ACTIVE" | "DRAFT" | "INACTIVE" | "ARCHIVED";
  categoryId?: string;
  brandId?: string;
  stockState?: "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "createdAt" | "title" | "basePrice" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export async function getProducts(params: GetProductsParams = {}) {
  try {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    // 1. Status Filter
    if (params.status && params.status !== "ALL") {
      where.status = params.status;
    }

    // 2. Category Filter
    if (params.categoryId && params.categoryId !== "ALL") {
      where.categoryId = params.categoryId;
    }

    // 3. Brand Filter
    if (params.brandId && params.brandId !== "ALL") {
      where.brandId = params.brandId;
    }

    // 4. Search Filter (name, SKU, slug)
    if (params.search && params.search.trim().length > 0) {
      const q = params.search.trim();
      where.OR = [
        { title: { contains: q } },
        { slug: { contains: q } },
        {
          variants: {
            some: {
              sku: { contains: q },
            },
          },
        },
      ];
    }

    // 5. Price Range
    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.basePrice = {};
      if (params.minPrice !== undefined) where.basePrice.gte = params.minPrice;
      if (params.maxPrice !== undefined) where.basePrice.lte = params.maxPrice;
    }

    // 6. Stock state filter
    if (params.stockState && params.stockState !== "ALL") {
      if (params.stockState === "OUT_OF_STOCK") {
        where.variants = {
          every: {
            stock: 0,
          },
        };
      } else if (params.stockState === "LOW_STOCK") {
        where.variants = {
          some: {
            stock: { gt: 0, lte: 10 },
          },
        };
      } else if (params.stockState === "IN_STOCK") {
        where.variants = {
          some: {
            stock: { gt: 10 },
          },
        };
      }
    }

    // Determine Sort
    const orderBy: any = {};
    const sortField = params.sortBy || "updatedAt";
    orderBy[sortField] = params.sortOrder || "desc";

    // Run queries in parallel: items, total matching count, and tab counts
    const [products, totalCount, activeCount, draftCount, inactiveCount, archivedCount, totalAllCount] =
      await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: {
              select: { id: true, name: true, slug: true, parentId: true, hsnCode: true },
            },
            brand: {
              select: { id: true, name: true, slug: true },
            },
            variants: {
              where: { deletedAt: null },
              select: {
                id: true,
                title: true,
                sku: true,
                price: true,
                mrp: true,
                stock: true,
                isDefault: true,
                isActive: true,
                isAvailable: true,
              },
              orderBy: { position: "asc" },
            },
            images: {
              include: {
                image: {
                  select: { id: true, url: true, alt: true, filename: true },
                },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy,
          skip,
          take: limit,
        }),
        prisma.product.count({ where }),
        prisma.product.count({ where: { deletedAt: null, status: "ACTIVE" } }),
        prisma.product.count({ where: { deletedAt: null, status: "DRAFT" } }),
        prisma.product.count({ where: { deletedAt: null, status: "INACTIVE" } }),
        prisma.product.count({ where: { deletedAt: null, status: "ARCHIVED" } }),
        prisma.product.count({ where: { deletedAt: null } }),
      ]);

    return {
      success: true,
      products,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
      counts: {
        all: totalAllCount,
        active: activeCount,
        draft: draftCount,
        inactive: inactiveCount,
        archived: archivedCount,
      },
    };
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return { success: false, error: error.message || "Failed to fetch products" };
  }
}

// ─── GET PRODUCT DETAILS ─────────────────────────────────────────────────────

export async function getProductDetails(id: string) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          where: { deletedAt: null },
          include: {
            attributeValues: {
              include: {
                attribute: true,
                attributeValue: true,
              },
            },
          },
          orderBy: { position: "asc" },
        },
        attributeValues: {
          include: {
            attribute: true,
            attributeValue: true,
          },
        },
        images: {
          include: {
            image: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
        category: {
          include: {
            categoryAttributes: {
              include: {
                attribute: {
                  include: {
                    values: {
                      where: { isActive: true },
                      orderBy: { displayOrder: "asc" },
                    },
                  },
                },
              },
              orderBy: { displayOrder: "asc" },
            },
          },
        },
        brand: true,
        drafts: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    // Check order history count
    const orderHistoryCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    return { success: true, product, orderHistoryCount };
  } catch (error: any) {
    console.error(`Error fetching product details for ${id}:`, error);
    return { success: false, error: error.message || "Failed to fetch product" };
  }
}

// ─── GET FORM METADATA (Categories, Brands, Attributes, Images) ──────────────

export async function getFormMetadata(categoryId?: string) {
  try {
    const [categories, brands, images, attributes] = await Promise.all([
      prisma.category.findMany({
        where: { deletedAt: null },
        include: {
          categoryAttributes: {
            include: {
              attribute: {
                include: {
                  values: {
                    where: { isActive: true },
                    orderBy: { displayOrder: "asc" },
                  },
                },
              },
            },
            orderBy: { displayOrder: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.brand.findMany({
        where: { deletedAt: null },
        orderBy: { name: "asc" },
      }),
      prisma.mediaImage.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.attribute.findMany({
        where: { isActive: true, deletedAt: null },
        include: {
          values: {
            where: { isActive: true, deletedAt: null },
            orderBy: { displayOrder: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      success: true,
      categories,
      brands,
      images,
      attributes,
    };
  } catch (error: any) {
    console.error("Error fetching metadata for product form:", error);
    return { success: false, error: error.message || "Failed to load form options" };
  }
}

// ─── PERMISSIVE DRAFT SAVE (AUTOSAVE & EXPLICIT DRAFT) ────────────────────────

export async function saveProductDraft(data: any) {
  try {
    const parsed = productDraftSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid draft data",
        fieldErrors: formatZodErrors(parsed.error),
      };
    }
    const d = parsed.data;

    // Generate slug if none provided
    const baseSlug = d.slug && d.slug.trim().length > 0 ? d.slug.trim() : generateSlug(d.title);
    let finalSlug = baseSlug || `draft-${Date.now()}`;

    // Ensure unique slug
    const existingWithSlug = await prisma.product.findFirst({
      where: {
        slug: finalSlug,
        ...(d.id ? { id: { not: d.id } } : {}),
      },
    });
    if (existingWithSlug) {
      finalSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Default price to first variant price or basePrice
    let calculatedBasePrice = Number(d.basePrice) || 0;
    if (calculatedBasePrice === 0 && d.variants && d.variants.length > 0) {
      const firstWithPrice = d.variants.find((v: any) => v.price && Number(v.price) > 0);
      if (firstWithPrice) {
        calculatedBasePrice = Number(firstWithPrice.price);
      }
    }

    // Fallback category if none selected
    let targetCategoryId = d.categoryId;
    if (!targetCategoryId) {
      const firstCat = await prisma.category.findFirst({ orderBy: { name: "asc" } });
      if (firstCat) {
        targetCategoryId = firstCat.id;
      }
    }

    const savedProduct = await prisma.$transaction(async (tx) => {
      let productRecord;

      if (d.id) {
        // Update existing product
        productRecord = await tx.product.update({
          where: { id: d.id },
          data: {
            title: d.title,
            slug: finalSlug,
            description: d.description || "",
            shortDescription: d.shortDescription || null,
            basePrice: calculatedBasePrice,
            categoryId: targetCategoryId,
            brandId: d.brandId || null,
            unit: d.unit || "Piece",
            hsnCode: d.hsnCode || null,
            gstRate: d.gstRate ? Number(d.gstRate) : null,
            status: d.status || "DRAFT",
            isAvailable: d.status === "ACTIVE",
            metaTitle: d.metaTitle || null,
            metaDescription: d.metaDescription || null,
            specs: JSON.stringify(d.specs || {}),
            version: { increment: 1 },
          },
        });
      } else {
        // Create new draft product
        productRecord = await tx.product.create({
          data: {
            title: d.title,
            slug: finalSlug,
            description: d.description || "",
            shortDescription: d.shortDescription || null,
            basePrice: calculatedBasePrice,
            categoryId: targetCategoryId,
            brandId: d.brandId || null,
            unit: d.unit || "Piece",
            hsnCode: d.hsnCode || null,
            gstRate: d.gstRate ? Number(d.gstRate) : null,
            checkoutMode: d.checkoutMode || "BUY",
            stockMode: d.stockMode || "TRACKED",
            status: "DRAFT",
            isAvailable: false,
            metaTitle: d.metaTitle || null,
            metaDescription: d.metaDescription || null,
            specs: JSON.stringify(d.specs || {}),
          },
        });
      }

      // Sync Variants
      if (d.variants && d.variants.length > 0) {
        const incomingIds = d.variants.map((v: any) => v.id).filter(Boolean);
        await tx.productVariant.deleteMany({
          where: {
            productId: productRecord.id,
            ...(incomingIds.length > 0 ? { id: { notIn: incomingIds } } : {}),
          },
        });

        for (let idx = 0; idx < d.variants.length; idx++) {
          const v = d.variants[idx];
          const autoSku = v.sku && v.sku.trim().length > 0
            ? v.sku.trim()
            : `VE-${productRecord.id.slice(0, 4).toUpperCase()}-${idx + 1}`;

          let variantId = v.id;
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                title: v.title || `Variant ${idx + 1}`,
                sku: autoSku,
                price: v.price !== undefined && v.price !== null ? Number(v.price) : null,
                mrp: v.mrp !== undefined && v.mrp !== null ? Number(v.mrp) : null,
                stock: Number(v.stock) || 0,
                color: v.color || null,
                size: v.size || null,
                weightGrams: v.weightGrams ? Number(v.weightGrams) : null,
                lengthMm: v.lengthMm ? Number(v.lengthMm) : null,
                widthMm: v.widthMm ? Number(v.widthMm) : null,
                heightMm: v.heightMm ? Number(v.heightMm) : null,
                isDefault: Boolean(v.isDefault || idx === 0),
                position: idx,
                isActive: v.isActive !== false,
                isAvailable: v.isAvailable !== false,
              },
            });
            await tx.variantAttributeValue.deleteMany({ where: { variantId: v.id } });
          } else {
            const created = await tx.productVariant.create({
              data: {
                productId: productRecord.id,
                title: v.title || `Variant ${idx + 1}`,
                sku: autoSku,
                price: v.price !== undefined && v.price !== null ? Number(v.price) : null,
                mrp: v.mrp !== undefined && v.mrp !== null ? Number(v.mrp) : null,
                stock: Number(v.stock) || 0,
                color: v.color || null,
                size: v.size || null,
                weightGrams: v.weightGrams ? Number(v.weightGrams) : null,
                lengthMm: v.lengthMm ? Number(v.lengthMm) : null,
                widthMm: v.widthMm ? Number(v.widthMm) : null,
                heightMm: v.heightMm ? Number(v.heightMm) : null,
                isDefault: Boolean(v.isDefault || idx === 0),
                position: idx,
                isActive: v.isActive !== false,
                isAvailable: v.isAvailable !== false,
              },
            });
            variantId = created.id;
          }

          if (v.attributeValues && v.attributeValues.length > 0 && variantId) {
            await tx.variantAttributeValue.createMany({
              data: v.attributeValues.map((av: any) => ({
                variantId,
                attributeId: av.attributeId,
                attributeValueId: av.attributeValueId,
              })),
            });
          }
        }
      } else {
        // Create single default variant
        const existingDefault = await tx.productVariant.findFirst({
          where: { productId: productRecord.id },
        });
        if (!existingDefault) {
          await tx.productVariant.create({
            data: {
              productId: productRecord.id,
              title: "Standard",
              sku: `VE-${productRecord.id.slice(0, 6).toUpperCase()}-DEF`,
              price: calculatedBasePrice > 0 ? calculatedBasePrice : null,
              stock: 0,
              isDefault: true,
              position: 0,
              isActive: true,
              isAvailable: true,
            },
          });
        }
      }

      // Sync Images
      if (d.images && d.images.length > 0) {
        await tx.productImage.deleteMany({ where: { productId: productRecord.id } });
        await tx.productImage.createMany({
          data: d.images.map((img: any, idx: number) => ({
            productId: productRecord.id,
            imageId: img.imageId,
            sortOrder: img.sortOrder !== undefined ? img.sortOrder : idx,
            isMain: idx === 0,
            altText: img.altText || null,
          })),
        });
      }

      // Sync Attributes
      if (d.attributeValues && d.attributeValues.length > 0) {
        await tx.productAttributeValue.deleteMany({ where: { productId: productRecord.id } });
        await tx.productAttributeValue.createMany({
          data: d.attributeValues.map((av: any) => ({
            productId: productRecord.id,
            attributeId: av.attributeId,
            attributeValueId: av.attributeValueId || null,
            textValue: av.textValue || null,
            numberValue: av.numberValue !== undefined && av.numberValue !== null ? Number(av.numberValue) : null,
            boolValue: av.boolValue !== undefined ? Boolean(av.boolValue) : null,
          })),
        });
      }

      // Record autosave payload in ProductDraft
      await tx.productDraft.create({
        data: {
          productId: productRecord.id,
          payload: JSON.stringify(data),
        },
      });

      return productRecord;
    });

    safeRevalidatePath("/admin/products");
    if (d.id) {
      safeRevalidatePath(`/admin/products/${d.id}/edit`);
    }

    return {
      success: true,
      product: savedProduct,
      savedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  } catch (error: any) {
    console.error("Error saving draft:", error);
    return { success: false, error: error.message || "Failed to save draft" };
  }
}

// ─── PUBLISH PRODUCT (FR-14 / FR-15 / FR-16 VALIDATION GATE) ─────────────────

export async function publishProduct(id: string, formData?: any) {
  try {
    // 1. If formData is provided, save it first
    if (formData) {
      formData.id = id;
      const saveRes = await saveProductDraft(formData);
      if (!saveRes.success) {
        return { success: false, error: saveRes.error, status: 400 };
      }
    }

    // 2. Fetch full current product state
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: { where: { deletedAt: null } },
        images: { include: { image: true } },
        attributeValues: true,
        category: {
          include: {
            categoryAttributes: {
              where: { isRequired: true },
              include: { attribute: true },
            },
          },
        },
      },
    });

    if (!product) {
      return { success: false, error: "Product not found", status: 404 };
    }

    // 3. Evaluate Publish Validation Gate
    const categoryContext = {
      id: product.category.id,
      name: product.category.name,
      hsnCode: product.category.hsnCode,
      requiredAttributeIds: product.category.categoryAttributes.map((ca) => ({
        id: ca.attributeId,
        name: ca.attribute.name,
      })),
    };

    const gateResult = evaluatePublishGate(
      {
        title: product.title,
        description: product.description,
        categoryId: product.categoryId,
        brandId: product.brandId,
        unit: product.unit,
        hsnCode: product.hsnCode,
        metaDescription: product.metaDescription,
        images: product.images.map((img) => ({
          imageId: img.imageId,
          altText: img.altText || img.image?.alt,
        })),
        variants: product.variants.map((v) => ({
          title: v.title,
          price: v.price,
          mrp: v.mrp,
          stock: v.stock,
          isActive: v.isActive,
          sku: v.sku,
        })),
        attributeValues: product.attributeValues,
      },
      categoryContext
    );

    // If gate fails, return 422 with checks
    if (!gateResult.canPublish) {
      return {
        success: false,
        status: 422,
        error: "Product does not meet quality requirements to go live",
        checks: gateResult.checks,
        blockingIssues: gateResult.blockingIssues,
        warnings: gateResult.warnings,
      };
    }

    // 4. Update status to ACTIVE
    const updated = await prisma.product.update({
      where: { id },
      data: {
        status: "ACTIVE",
        isAvailable: true,
        publishedAt: product.publishedAt || new Date(),
        version: { increment: 1 },
      },
    });

    // 5. Log audit
    await prisma.auditLog.create({
      data: {
        actorId: "SYSTEM",
        actorName: "Catalog Manager",
        actorRole: "CATALOG_MANAGER",
        entity: "PRODUCT",
        entityId: id,
        action: "PUBLISH_PRODUCT",
        beforeState: JSON.stringify({ status: product.status }),
        afterState: JSON.stringify({ status: "ACTIVE", publishedAt: updated.publishedAt }),
      },
    });

    safeRevalidatePath("/admin/products");
    safeRevalidatePath(`/admin/products/${id}/edit`);

    return {
      success: true,
      published: true,
      warnings: gateResult.warnings,
      product: updated,
    };
  } catch (error: any) {
    console.error("Error publishing product:", error);
    return { success: false, error: error.message || "Failed to publish product", status: 500 };
  }
}

// ─── UPDATE PRODUCT STATUS (LIFECYCLE TRANSITIONS) ───────────────────────────

export async function updateProductStatus(
  id: string,
  targetStatus: "ACTIVE" | "INACTIVE" | "ARCHIVED" | "RESTORE"
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: { where: { deletedAt: null } },
        images: true,
      },
    });

    if (!product) {
      return { success: false, error: "Product not found" };
    }

    // Check order history
    const orderHistoryCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    let newStatus: string;
    let newIsAvailable = false;
    let archivedAt: Date | null = product.archivedAt;

    if (targetStatus === "ACTIVE") {
      // Re-run publish gate!
      const publishRes = await publishProduct(id);
      return publishRes;
    } else if (targetStatus === "INACTIVE") {
      newStatus = "INACTIVE";
      newIsAvailable = false;
    } else if (targetStatus === "ARCHIVED") {
      newStatus = "ARCHIVED";
      newIsAvailable = false;
      archivedAt = new Date();
    } else if (targetStatus === "RESTORE") {
      // RESTORE ALWAYS RETURNS TO INACTIVE, NEVER STRAIGHT TO ACTIVE (FR-09)
      newStatus = "INACTIVE";
      newIsAvailable = false;
      archivedAt = null;
    } else {
      return { success: false, error: "Invalid status transition" };
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        status: newStatus,
        isAvailable: newIsAvailable,
        archivedAt,
        version: { increment: 1 },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: "SYSTEM",
        actorName: "Catalog Manager",
        actorRole: "CATALOG_MANAGER",
        entity: "PRODUCT",
        entityId: id,
        action: `STATUS_CHANGE_${targetStatus}`,
        beforeState: JSON.stringify({ status: product.status, isAvailable: product.isAvailable }),
        afterState: JSON.stringify({ status: newStatus, isAvailable: newIsAvailable }),
      },
    });

    safeRevalidatePath("/admin/products");
    safeRevalidatePath(`/admin/products/${id}/edit`);

    return {
      success: true,
      product: updated,
      message:
        targetStatus === "RESTORE"
          ? "Restored as inactive. Activate it when you're ready to sell it again."
          : `Product status updated to ${newStatus}`,
    };
  } catch (error: any) {
    console.error("Error updating status:", error);
    return { success: false, error: error.message || "Failed to update product status" };
  }
}

// ─── DUPLICATE PRODUCT (PROD-12) ─────────────────────────────────────────────

export async function duplicateProduct(id: string) {
  try {
    const source = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          where: { deletedAt: null },
          include: { attributeValues: true },
        },
        images: true,
        attributeValues: true,
      },
    });

    if (!source) {
      return { success: false, error: "Source product not found" };
    }

    const newTitle = `Copy of ${source.title}`;
    const baseSlug = generateSlug(newTitle);
    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
    const newSlug = `${baseSlug}-${uniqueSuffix}`;

    const duplicated = await prisma.$transaction(async (tx) => {
      // 1. Create product clone as DRAFT
      const newProduct = await tx.product.create({
        data: {
          title: newTitle,
          slug: newSlug,
          description: source.description,
          shortDescription: source.shortDescription,
          basePrice: source.basePrice,
          checkoutMode: source.checkoutMode,
          stockMode: source.stockMode,
          status: "DRAFT",
          isAvailable: false,
          categoryId: source.categoryId,
          brandId: source.brandId,
          unit: source.unit,
          hsnCode: source.hsnCode,
          gstRate: source.gstRate,
          metaTitle: source.metaTitle ? `Copy of ${source.metaTitle}` : null,
          metaDescription: source.metaDescription,
          specs: source.specs,
        },
      });

      // 2. Clone Variants with fresh SKUs and 0 stock
      for (let idx = 0; idx < source.variants.length; idx++) {
        const v = source.variants[idx];
        const newSku = `${v.sku || "VE"}-CPY-${uniqueSuffix}-${idx + 1}`;

        const createdVariant = await tx.productVariant.create({
          data: {
            productId: newProduct.id,
            title: v.title,
            sku: newSku,
            price: v.price,
            mrp: v.mrp,
            stock: 0, // Stock resets to 0 per PROD-12
            color: v.color,
            size: v.size,
            weightGrams: v.weightGrams,
            lengthMm: v.lengthMm,
            widthMm: v.widthMm,
            heightMm: v.heightMm,
            isDefault: v.isDefault,
            position: v.position,
            isActive: v.isActive,
            isAvailable: true,
          },
        });

        if (v.attributeValues.length > 0) {
          await tx.variantAttributeValue.createMany({
            data: v.attributeValues.map((av) => ({
              variantId: createdVariant.id,
              attributeId: av.attributeId,
              attributeValueId: av.attributeValueId,
            })),
          });
        }
      }

      // 3. Clone Images
      if (source.images.length > 0) {
        await tx.productImage.createMany({
          data: source.images.map((img) => ({
            productId: newProduct.id,
            imageId: img.imageId,
            sortOrder: img.sortOrder,
            isMain: img.isMain,
            altText: img.altText,
          })),
        });
      }

      // 4. Clone Attributes
      if (source.attributeValues.length > 0) {
        await tx.productAttributeValue.createMany({
          data: source.attributeValues.map((av) => ({
            productId: newProduct.id,
            attributeId: av.attributeId,
            attributeValueId: av.attributeValueId,
            textValue: av.textValue,
            numberValue: av.numberValue,
            boolValue: av.boolValue,
          })),
        });
      }

      return newProduct;
    });

    safeRevalidatePath("/admin/products");
    return { success: true, newProductId: duplicated.id, product: duplicated };
  } catch (error: any) {
    console.error("Error duplicating product:", error);
    return { success: false, error: error.message || "Failed to duplicate product" };
  }
}

// ─── BULK STATUS & CATEGORY ACTIONS (PROD-10) ────────────────────────────────

export async function bulkUpdateStatus(
  productIds: string[],
  action: "ACTIVATE" | "DEACTIVATE" | "ARCHIVE"
) {
  try {
    if (!productIds || productIds.length === 0) {
      return { success: false, error: "No products selected" };
    }

    if (action === "ACTIVATE") {
      // Run publish gate per product
      const successfulIds: string[] = [];
      const failedItems: Array<{ id: string; title: string; issues: string[] }> = [];

      for (const id of productIds) {
        const res = await publishProduct(id);
        if (res.success) {
          successfulIds.push(id);
        } else {
          const prod = await prisma.product.findUnique({
            where: { id },
            select: { title: true },
          });
          failedItems.push({
            id,
            title: prod?.title || id,
            issues: res.blockingIssues?.map((b: any) => b.message) || [res.error || "Failed check"],
          });
        }
      }

      safeRevalidatePath("/admin/products");
      return {
        success: true,
        activatedCount: successfulIds.length,
        failedCount: failedItems.length,
        failedItems,
        message: `${successfulIds.length} of ${productIds.length} activated.${
          failedItems.length > 0 ? ` ${failedItems.length} could not be published.` : ""
        }`,
      };
    }

    const targetStatus = action === "DEACTIVATE" ? "INACTIVE" : "ARCHIVED";
    const isAvailable = false;
    const archivedAt = action === "ARCHIVE" ? new Date() : undefined;

    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: {
        status: targetStatus,
        isAvailable,
        ...(archivedAt ? { archivedAt } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: "SYSTEM",
        actorName: "Catalog Manager",
        actorRole: "CATALOG_MANAGER",
        entity: "PRODUCT",
        entityId: `BULK_${productIds.length}`,
        action: `BULK_${action}`,
        afterState: JSON.stringify({ productIds, status: targetStatus }),
      },
    });

    safeRevalidatePath("/admin/products");
    return {
      success: true,
      message: `${productIds.length} products ${action.toLowerCase()}d successfully.`,
    };
  } catch (error: any) {
    console.error("Error running bulk status action:", error);
    return { success: false, error: error.message || "Failed bulk status update" };
  }
}

export async function bulkChangeCategory(productIds: string[], targetCategoryId: string) {
  try {
    const targetCategory = await prisma.category.findUnique({
      where: { id: targetCategoryId },
      include: {
        categoryAttributes: {
          select: { attributeId: true },
        },
      },
    });

    if (!targetCategory) {
      return { success: false, error: "Target category not found" };
    }

    const allowedAttrIds = targetCategory.categoryAttributes.map((ca) => ca.attributeId);

    await prisma.$transaction(async (tx) => {
      // 1. Update categoryId
      await tx.product.updateMany({
        where: { id: { in: productIds } },
        data: { categoryId: targetCategoryId },
      });

      // 2. Clear non-shared attribute values
      await tx.productAttributeValue.deleteMany({
        where: {
          productId: { in: productIds },
          attributeId: { notIn: allowedAttrIds },
        },
      });
    });

    safeRevalidatePath("/admin/products");
    return {
      success: true,
      message: `Updated category for ${productIds.length} products to ${targetCategory.name}.`,
    };
  } catch (error: any) {
    console.error("Error bulk changing category:", error);
    return { success: false, error: error.message || "Failed bulk category change" };
  }
}

// ─── BULK PRICE ADJUSTMENT & 30-SEC UNDO (PROD-11 / S4) ──────────────────────

export interface BulkPriceAdjustParams {
  productIds: string[];
  mode: "PERCENT" | "ABSOLUTE";
  direction: "INCREASE" | "DECREASE";
  value: number;
  applyTo: "MRP" | "SELLING" | "BOTH";
  rounding: "NONE" | "NEAREST_1" | "NEAREST_10" | "END_IN_9";
  conflictResolution?: "SKIP" | "RAISE_MRP";
  dryRun: boolean;
}

function applyRounding(val: number, rounding: string): number {
  if (val <= 0) return 0;
  if (rounding === "NEAREST_1") {
    return Math.round(val);
  } else if (rounding === "NEAREST_10") {
    return Math.round(val / 10) * 10;
  } else if (rounding === "END_IN_9") {
    const tens = Math.floor(val / 10) * 10;
    return tens + 9;
  }
  return Math.round(val * 100) / 100;
}

export async function bulkAdjustPrice(params: BulkPriceAdjustParams) {
  try {
    const { productIds, mode, direction, value, applyTo, rounding, conflictResolution, dryRun } =
      params;

    if (!productIds || productIds.length === 0) {
      return { success: false, error: "No products selected" };
    }

    const val = Number(value);
    if (isNaN(val) || val <= 0) {
      return { success: false, error: "Please enter a valid price adjustment value" };
    }

    // Fetch all variants for the selected products
    const variants = await prisma.productVariant.findMany({
      where: {
        productId: { in: productIds },
        deletedAt: null,
      },
      select: {
        id: true,
        productId: true,
        title: true,
        sku: true,
        price: true,
        mrp: true,
      },
    });

    const multiplier = direction === "INCREASE" ? 1 : -1;
    let conflictCount = 0;
    const computedVariants: Array<{
      id: string;
      sku: string;
      title: string;
      oldPrice: number;
      newPrice: number;
      oldMrp: number;
      newMrp: number;
      hasConflict: boolean;
    }> = [];

    for (const v of variants) {
      const oldP = Number(v.price) || 0;
      const oldM = Number(v.mrp) || oldP;
      let newP = oldP;
      let newM = oldM;

      // Calculate new Selling Price
      if (applyTo === "SELLING" || applyTo === "BOTH") {
        if (mode === "PERCENT") {
          newP = oldP + multiplier * oldP * (val / 100);
        } else {
          newP = oldP + multiplier * val;
        }
        newP = Math.max(1, applyRounding(newP, rounding));
      }

      // Calculate new MRP
      if (applyTo === "MRP" || applyTo === "BOTH") {
        if (mode === "PERCENT") {
          newM = oldM + multiplier * oldM * (val / 100);
        } else {
          newM = oldM + multiplier * val;
        }
        newM = Math.max(1, applyRounding(newM, rounding));
      }

      // Check conflict: new Selling Price > new MRP
      const conflict = newP > newM;
      if (conflict) {
        conflictCount++;
        if (conflictResolution === "RAISE_MRP") {
          newM = newP;
        }
      }

      computedVariants.push({
        id: v.id,
        sku: v.sku || "SKU",
        title: v.title,
        oldPrice: oldP,
        newPrice: newP,
        oldMrp: oldM,
        newMrp: newM,
        hasConflict: conflict,
      });
    }

    // If DRY RUN: return server-computed preview without modifying database
    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        totalVariants: variants.length,
        conflictCount,
        preview: computedVariants.slice(0, 10),
      };
    }

    // LIVE RUN: Atomic transaction with batch ID and undo snapshot
    const batchId = `BATCH_PRICE_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const snapshot: Record<string, { price: number | null; mrp: number | null }> = {};

    for (const v of variants) {
      snapshot[v.id] = { price: v.price, mrp: v.mrp };
    }

    await prisma.$transaction(async (tx) => {
      for (const cv of computedVariants) {
        if (cv.hasConflict && conflictResolution === "SKIP") {
          continue;
        }

        await tx.productVariant.update({
          where: { id: cv.id },
          data: {
            price: cv.newPrice,
            mrp: cv.newMrp,
          },
        });
      }

      // Record batch in audit log for 30s undo
      await tx.auditLog.create({
        data: {
          actorId: "SYSTEM",
          actorName: "Catalog Manager",
          actorRole: "CATALOG_MANAGER",
          entity: "PRICE_BATCH",
          entityId: batchId,
          action: "BULK_PRICE_ADJUST",
          beforeState: JSON.stringify(snapshot),
          afterState: JSON.stringify({
            params,
            affectedCount: computedVariants.length,
          }),
        },
      });
    });

    safeRevalidatePath("/admin/products");
    return {
      success: true,
      batchId,
      affectedCount: computedVariants.length,
      message: `Adjusted prices across ${computedVariants.length} variants.`,
    };
  } catch (error: any) {
    console.error("Error applying bulk price adjustment:", error);
    return { success: false, error: error.message || "Failed bulk price adjustment" };
  }
}

export async function undoPriceAdjustment(batchId: string) {
  try {
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        entity: "PRICE_BATCH",
        entityId: batchId,
        action: "BULK_PRICE_ADJUST",
      },
      orderBy: { timestamp: "desc" },
    });

    if (!auditRecord || !auditRecord.beforeState) {
      return { success: false, error: "Adjustment batch expired or not found" };
    }

    const previousStates: Record<string, { price: number | null; mrp: number | null }> = JSON.parse(
      auditRecord.beforeState
    );

    await prisma.$transaction(async (tx) => {
      for (const [variantId, state] of Object.entries(previousStates)) {
        await tx.productVariant.update({
          where: { id: variantId },
          data: {
            price: state.price,
            mrp: state.mrp,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: "SYSTEM",
          actorName: "Catalog Manager",
          actorRole: "CATALOG_MANAGER",
          entity: "PRICE_BATCH",
          entityId: batchId,
          action: "UNDO_BULK_PRICE_ADJUST",
          afterState: JSON.stringify({ revertedBatchId: batchId }),
        },
      });
    });

    safeRevalidatePath("/admin/products");
    return {
      success: true,
      message: `Successfully reverted price adjustments for batch ${batchId}`,
    };
  } catch (error: any) {
    console.error("Error undoing price adjustment:", error);
    return { success: false, error: error.message || "Failed to undo price adjustment" };
  }
}

// ─── SAVED PRODUCT VIEWS (PROD-16) ───────────────────────────────────────────

export async function getSavedViews() {
  try {
    const views = await prisma.savedProductView.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, views };
  } catch (error: any) {
    return { success: false, views: [] };
  }
}

export async function saveProductView(name: string, filters: Record<string, any>) {
  try {
    const view = await prisma.savedProductView.create({
      data: {
        name,
        filters: JSON.stringify(filters),
      },
    });
    return { success: true, view };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to save view" };
  }
}

export async function deleteSavedView(id: string) {
  try {
    await prisma.savedProductView.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete view" };
  }
}

// ─── DELETE PRODUCT (SOFT / PERMITTED ONLY IF NO ORDERS) ─────────────────────

export async function deleteProduct(id: string) {
  try {
    const orderItemCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderItemCount > 0) {
      return {
        success: false,
        error: "This product has existing order history and cannot be deleted. Please Archive it instead.",
        status: 409,
      };
    }

    await prisma.product.delete({
      where: { id },
    });

    safeRevalidatePath("/admin/products");
    return { success: true, message: "Product deleted successfully" };
  } catch (error: any) {
    console.error("Error deleting product:", error);
    return { success: false, error: error.message || "Failed to delete product" };
  }
}

// ─── COMPATIBILITY ALIASES FOR PREVIOUS PAGES ────────────────────────────────

export async function createProduct(data: any) {
  return saveProductDraft(data);
}

export async function updateProduct(id: string, data: any) {
  return saveProductDraft({ ...data, id });
}

export async function toggleProductAvailability(id: string, isAvailable: boolean) {
  try {
    const updated = await prisma.product.update({
      where: { id },
      data: {
        isAvailable,
        status: isAvailable ? "ACTIVE" : "INACTIVE",
      },
    });
    safeRevalidatePath("/admin/products");
    return { success: true, product: updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update availability" };
  }
}

