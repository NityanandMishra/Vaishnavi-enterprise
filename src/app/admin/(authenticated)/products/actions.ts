"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

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
        variants: true,
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
    title: string;
    sku?: string | null;
    price?: number | null;
    stock: number;
    color?: string | null;
    size?: string | null;
    isAvailable: boolean;
  }[];
  images: {
    imageId: string;
    sortOrder: number;
    isMain: boolean;
  }[];
}) {
  try {
    if (!data.title.trim()) throw new Error("Title is required");
    if (!data.categoryId) throw new Error("Category is required");
    if (data.images.length === 0)
      throw new Error("At least one image is required to publish a product.");

    // Perform database operations in a transaction
    const newProduct = await prisma.$transaction(async (tx) => {
      // 1. Create product
      const product = await tx.product.create({
        data: {
          title: data.title.trim(),
          description: data.description.trim(),
          basePrice: Number(data.basePrice),
          checkoutMode: data.checkoutMode,
          stockMode: data.stockMode,
          isAvailable: data.isAvailable,
          categoryId: data.categoryId,
          brandId: data.brandId || null,
          specs: JSON.stringify(data.specs),
        },
      });

      // 2. Create variants
      if (data.variants.length > 0) {
        await tx.productVariant.createMany({
          data: data.variants.map((v) => ({
            productId: product.id,
            title: v.title.trim(),
            sku: v.sku?.trim() || null,
            price: v.price ? Number(v.price) : null,
            stock: Number(v.stock),
            color: v.color?.trim() || null,
            size: v.size?.trim() || null,
            isAvailable: v.isAvailable,
          })),
        });
      } else {
        // Create default variant if none provided
        await tx.productVariant.create({
          data: {
            productId: product.id,
            title: "Standard",
            stock: 0,
            isAvailable: true,
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
      stock: number;
      color?: string | null;
      size?: string | null;
      isAvailable: boolean;
    }[];
    images: {
      imageId: string;
      sortOrder: number;
      isMain: boolean;
    }[];
  }
) {
  try {
    if (!data.title.trim()) throw new Error("Title is required");
    if (!data.categoryId) throw new Error("Category is required");
    if (data.images.length === 0)
      throw new Error("At least one image is required to publish a product.");

    await prisma.$transaction(async (tx) => {
      // 1. Update product base data
      await tx.product.update({
        where: { id },
        data: {
          title: data.title.trim(),
          description: data.description.trim(),
          basePrice: Number(data.basePrice),
          checkoutMode: data.checkoutMode,
          stockMode: data.stockMode,
          isAvailable: data.isAvailable,
          categoryId: data.categoryId,
          brandId: data.brandId || null,
          specs: JSON.stringify(data.specs),
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
        if (v.id) {
          // Update
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              title: v.title.trim(),
              sku: v.sku?.trim() || null,
              price: v.price ? Number(v.price) : null,
              stock: Number(v.stock),
              color: v.color?.trim() || null,
              size: v.size?.trim() || null,
              isAvailable: v.isAvailable,
            },
          });
        } else {
          // Create
          await tx.productVariant.create({
            data: {
              productId: id,
              title: v.title.trim(),
              sku: v.sku?.trim() || null,
              price: v.price ? Number(v.price) : null,
              stock: Number(v.stock),
              color: v.color?.trim() || null,
              size: v.size?.trim() || null,
              isAvailable: v.isAvailable,
            },
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
