"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { productInputSchema, formatZodErrors } from "@/lib/validations/product";

export async function getProducts() {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: {
          select: {
            name: true,
          },
        },
        brand: {
          select: {
            name: true,
          },
        },
        variants: {
          select: {
            id: true,
            title: true,
            sku: true,
            price: true,
            stock: true,
            isAvailable: true,
          },
        },
        images: {
          include: {
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, products };
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return { success: false, error: error.message || "Failed to fetch products" };
  }
}

export async function getProductDetails(id: string) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            attributeValues: {
              include: {
                attribute: true,
                attributeValue: true,
              },
            },
          },
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
        category: true,
        brand: true,
      },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    return { success: true, product };
  } catch (error: any) {
    console.error(`Error fetching product details for ${id}:`, error);
    return { success: false, error: error.message || "Failed to fetch product" };
  }
}

export async function getFormMetadata() {
  try {
    const [categories, brands, images] = await Promise.all([
      prisma.category.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.brand.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.mediaImage.findMany({
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      success: true,
      categories,
      brands,
      images,
    };
  } catch (error: any) {
    console.error("Error fetching metadata for product form:", error);
    return { success: false, error: error.message || "Failed to load form options" };
  }
}

export async function createProduct(data: {
  title: string;
  description: string;
  basePrice: number;
  checkoutMode: string;
  stockMode: string;
  isAvailable: boolean;
  categoryId: string;
  brandId?: string | null;
  specs: Record<string, string>;
  variants: {
    id?: string;
    title: string;
    sku?: string | null;
    price?: number | null;
    mrp?: number | null;
    stock: number;
    color?: string | null;
    size?: string | null;
    isActive?: boolean;
    isAvailable?: boolean;
    attributeValues?: Array<{
      attributeId: string;
      attributeValueId: string;
    }>;
  }[];
  images: {
    imageId: string;
    sortOrder: number;
    isMain: boolean;
  }[];
}) {
  try {
    const parsed = productInputSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Product validation failed",
        fieldErrors: formatZodErrors(parsed.error),
      };
    }
    const validData = parsed.data;

    // Perform database operations in a transaction
    const newProduct = await prisma.$transaction(async (tx) => {
      // 1. Create product
      const product = await tx.product.create({
        data: {
          title: validData.title,
          description: validData.description,
          basePrice: validData.basePrice,
          checkoutMode: validData.checkoutMode,
          stockMode: validData.stockMode,
          isAvailable: validData.isAvailable,
          categoryId: validData.categoryId,
          brandId: validData.brandId || null,
          specs: JSON.stringify(validData.specs || {}),
        },
      });

      // 2. Create variants & linkages
      if (data.variants.length > 0) {
        for (const v of data.variants) {
          const createdVariant = await tx.productVariant.create({
            data: {
              productId: product.id,
              title: v.title.trim(),
              sku: v.sku?.trim() || null,
              price: v.price ? Number(v.price) : null,
              mrp: v.mrp ? Number(v.mrp) : null,
              stock: Number(v.stock),
              color: v.color?.trim() || null,
              size: v.size?.trim() || null,
              isActive: v.isActive !== false,
              isAvailable: v.isAvailable !== false,
            },
          });

          if (v.attributeValues && v.attributeValues.length > 0) {
            await tx.variantAttributeValue.createMany({
              data: v.attributeValues.map((av) => ({
                variantId: createdVariant.id,
                attributeId: av.attributeId,
                attributeValueId: av.attributeValueId,
              })),
            });
          }
        }
      } else {
        // Create default variant if none provided
        await tx.productVariant.create({
          data: {
            productId: product.id,
            title: "Standard",
            stock: 0,
            isAvailable: true,
            isActive: true,
          },
        });
      }

      // 3. Create product image relationships
      if (data.images.length > 0) {
        await tx.productImage.createMany({
          data: data.images.map((img) => ({
            productId: product.id,
            imageId: img.imageId,
            sortOrder: img.sortOrder,
            isMain: img.isMain,
          })),
        });
      }

      return product;
    });

    revalidatePath("/admin/products");
    return { success: true, product: newProduct };
  } catch (error: any) {
    console.error("Error creating product:", error);
    return { success: false, error: error.message || "Failed to create product" };
  }
}

export async function updateProduct(
  id: string,
  data: {
    title: string;
    description: string;
    basePrice: number;
    checkoutMode: string;
    stockMode: string;
    isAvailable: boolean;
    categoryId: string;
    brandId?: string | null;
    specs: Record<string, string>;
    variants: {
      id?: string;
      title: string;
      sku?: string | null;
      price?: number | null;
      mrp?: number | null;
      stock: number;
      color?: string | null;
      size?: string | null;
      isActive?: boolean;
      isAvailable?: boolean;
      attributeValues?: Array<{
        attributeId: string;
        attributeValueId: string;
      }>;
    }[];
    images: {
      imageId: string;
      sortOrder: number;
      isMain: boolean;
    }[];
  }
) {
  try {
    const parsed = productInputSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Product validation failed",
        fieldErrors: formatZodErrors(parsed.error),
      };
    }
    const validData = parsed.data;

    await prisma.$transaction(async (tx) => {
      // 1. Update product base data
      await tx.product.update({
        where: { id },
        data: {
          title: validData.title,
          description: validData.description,
          basePrice: validData.basePrice,
          checkoutMode: validData.checkoutMode,
          stockMode: validData.stockMode,
          isAvailable: validData.isAvailable,
          categoryId: validData.categoryId,
          brandId: validData.brandId || null,
          specs: JSON.stringify(validData.specs || {}),
        },
      });

      // 2. Sync Images (Delete existing joins and recreate)
      await tx.productImage.deleteMany({
        where: { productId: id },
      });

      if (data.images.length > 0) {
        await tx.productImage.createMany({
          data: data.images.map((img) => ({
            productId: id,
            imageId: img.imageId,
            sortOrder: img.sortOrder,
            isMain: img.isMain,
          })),
        });
      }

      // 3. Sync Variants
      const existingVariants = await tx.productVariant.findMany({
        where: { productId: id },
      });

      const incomingVariantIds = data.variants
        .map((v) => v.id)
        .filter(Boolean) as string[];

      // Delete variants not present in incoming request
      const toDelete = existingVariants.filter(
        (ev) => !incomingVariantIds.includes(ev.id)
      );
      if (toDelete.length > 0) {
        await tx.productVariant.deleteMany({
          where: { id: { in: toDelete.map((v) => v.id) } },
        });
      }

      // Update matching variants & create new ones
      for (const v of data.variants) {
        let variantId = v.id;
        if (v.id) {
          // Update
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              title: v.title.trim(),
              sku: v.sku?.trim() || null,
              price: v.price ? Number(v.price) : null,
              mrp: v.mrp ? Number(v.mrp) : null,
              stock: Number(v.stock),
              color: v.color?.trim() || null,
              size: v.size?.trim() || null,
              isActive: v.isActive !== false,
              isAvailable: v.isAvailable !== false,
            },
          });

          await tx.variantAttributeValue.deleteMany({
            where: { variantId: v.id },
          });
        } else {
          // Create
          const created = await tx.productVariant.create({
            data: {
              productId: id,
              title: v.title.trim(),
              sku: v.sku?.trim() || null,
              price: v.price ? Number(v.price) : null,
              mrp: v.mrp ? Number(v.mrp) : null,
              stock: Number(v.stock),
              color: v.color?.trim() || null,
              size: v.size?.trim() || null,
              isActive: v.isActive !== false,
              isAvailable: v.isAvailable !== false,
            },
          });
          variantId = created.id;
        }

        if (v.attributeValues && v.attributeValues.length > 0 && variantId) {
          await tx.variantAttributeValue.createMany({
            data: v.attributeValues.map((av) => ({
              variantId,
              attributeId: av.attributeId,
              attributeValueId: av.attributeValueId,
            })),
          });
        }
      }
    });

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}/edit`);
    return { success: true };
  } catch (error: any) {
    console.error("Error updating product:", error);
    return { success: false, error: error.message || "Failed to update product" };
  }
}

export async function deleteProduct(id: string) {
  try {
    // Delete product will automatically cascade delete variant rows and image join rows
    await prisma.product.delete({
      where: { id },
    });

    revalidatePath("/admin/products");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting product:", error);
    return { success: false, error: error.message || "Failed to delete product" };
  }
}

export async function toggleProductAvailability(id: string, isAvailable: boolean) {
  try {
    await prisma.product.update({
      where: { id },
      data: { isAvailable },
    });

    revalidatePath("/admin/products");
    return { success: true };
  } catch (error: any) {
    console.error("Error toggling product status:", error);
    return { success: false, error: error.message || "Failed to update product availability" };
  }
}
