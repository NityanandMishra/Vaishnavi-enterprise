"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getCategories() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        image: true,
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: [
        { sortOrder: "asc" },
        { name: "asc" },
      ],
    });

    return { success: true, categories };
  } catch (error: any) {
    console.error("Error fetching categories:", error);
    return { success: false, error: error.message || "Failed to fetch categories" };
  }
}

export async function getCategoryImages() {
  try {
    const images = await prisma.mediaImage.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    return { success: true, images };
  } catch (error: any) {
    console.error("Error fetching media images:", error);
    return { success: false, error: error.message || "Failed to fetch images" };
  }
}

export async function createCategory(data: {
  name: string;
  slug?: string;
  description?: string;
  imageId?: string | null;
  defaultCheckoutMode: string;
  sortOrder?: number;
  parentId?: string | null;
}) {
  try {
    if (!data.name.trim()) {
      throw new Error("Category name is required");
    }

    const slug = data.slug?.trim()
      ? data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : data.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

    // Check slug uniqueness
    const existingSlug = await prisma.category.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      throw new Error(`A category with slug "${slug}" already exists.`);
    }

    // Check name uniqueness within the same parent scope (case-insensitive, SQLite-compatible)
    const parentId = data.parentId || null;
    const siblings = await prisma.category.findMany({
      where: { parentId },
      select: { id: true, name: true },
    });
    const nameConflict = siblings.find(
      (c) => c.name.trim().toLowerCase() === data.name.trim().toLowerCase()
    );
    if (nameConflict) {
      const scope = parentId ? "subcategory" : "category";
      throw new Error(`A ${scope} named "${data.name.trim()}" already exists${parentId ? " under this parent" : ""}.`);
    }

    const newCategory = await prisma.category.create({
      data: {
        name: data.name.trim(),
        slug,
        description: data.description?.trim() || null,
        imageId: data.imageId || null,
        defaultCheckoutMode: data.defaultCheckoutMode || "BUY",
        sortOrder: data.sortOrder || 0,
        parentId: data.parentId || null,
      },
    });

    revalidatePath("/admin/categories");
    return { success: true, category: newCategory };
  } catch (error: any) {
    console.error("Error creating category:", error);
    return { success: false, error: error.message || "Failed to create category" };
  }
}

export async function updateCategory(
  id: string,
  data: {
    name: string;
    slug: string;
    description?: string;
    imageId?: string | null;
    defaultCheckoutMode: string;
    sortOrder: number;
    parentId?: string | null;
  }
) {
  try {
    if (!data.name.trim()) {
      throw new Error("Category name is required");
    }

    const slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");

    // Circular reference check
    if (data.parentId === id) {
      throw new Error("A category cannot be its own parent.");
    }

    // Slug uniqueness check (excluding self)
    const existingSlug = await prisma.category.findFirst({
      where: {
        slug,
        id: { not: id },
      },
    });
    if (existingSlug) {
      throw new Error(`A category with slug "${slug}" already exists.`);
    }

    // Name uniqueness check within the same parent scope (excluding self, case-insensitive, SQLite-compatible)
    const parentId = data.parentId || null;
    const siblings = await prisma.category.findMany({
      where: { parentId },
      select: { id: true, name: true },
    });
    const nameConflict = siblings.find(
      (c) => c.id !== id && c.name.trim().toLowerCase() === data.name.trim().toLowerCase()
    );
    if (nameConflict) {
      const scope = parentId ? "subcategory" : "category";
      throw new Error(`A ${scope} named "${data.name.trim()}" already exists${parentId ? " under this parent" : ""}.`);
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        name: data.name.trim(),
        slug,
        description: data.description?.trim() || null,
        imageId: data.imageId || null,
        defaultCheckoutMode: data.defaultCheckoutMode,
        sortOrder: data.sortOrder,
        parentId: data.parentId || null,
      },
    });

    revalidatePath("/admin/categories");
    return { success: true, category: updatedCategory };
  } catch (error: any) {
    console.error("Error updating category:", error);
    return { success: false, error: error.message || "Failed to update category" };
  }
}

export async function deleteCategory(id: string) {
  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        children: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new Error("Category not found");
    }

    if (category._count.products > 0) {
      throw new Error(
        `Cannot delete category "${category.name}". It is associated with ${category._count.products} products.`
      );
    }

    if (category.children.length > 0) {
      throw new Error(
        `Cannot delete category "${category.name}". It has ${category.children.length} sub-categories.`
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    revalidatePath("/admin/categories");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting category:", error);
    return { success: false, error: error.message || "Failed to delete category" };
  }
}
