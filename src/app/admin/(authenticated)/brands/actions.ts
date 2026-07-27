"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getBrands() {
  try {
    const brands = await prisma.brand.findMany({
      include: {
        logo: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return { success: true, brands };
  } catch (error: any) {
    console.error("Error fetching brands:", error);
    return { success: false, error: error.message || "Failed to fetch brands" };
  }
}

export async function getLogoImages() {
  try {
    const images = await prisma.mediaImage.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    return { success: true, images };
  } catch (error: any) {
    console.error("Error fetching media images for logos:", error);
    return { success: false, error: error.message || "Failed to fetch images" };
  }
}

export async function createBrand(data: {
  name: string;
  slug?: string;
  description?: string;
  logoId?: string | null;
}) {
  try {
    if (!data.name.trim()) {
      throw new Error("Brand name is required");
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
    const existing = await prisma.brand.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new Error(`A brand with the slug "${slug}" already exists.`);
    }

    const newBrand = await prisma.brand.create({
      data: {
        name: data.name.trim(),
        slug,
        description: data.description?.trim() || null,
        logoId: data.logoId || null,
      },
    });

    revalidatePath("/admin/brands");
    return { success: true, brand: newBrand };
  } catch (error: any) {
    console.error("Error creating brand:", error);
    return { success: false, error: error.message || "Failed to create brand" };
  }
}

export async function updateBrand(
  id: string,
  data: {
    name: string;
    slug: string;
    description?: string;
    logoId?: string | null;
  }
) {
  try {
    if (!data.name.trim()) {
      throw new Error("Brand name is required");
    }

    const slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");

    // Check slug uniqueness (excluding current brand)
    const existing = await prisma.brand.findFirst({
      where: {
        slug,
        id: { not: id },
      },
    });
    if (existing) {
      throw new Error(`A brand with the slug "${slug}" already exists.`);
    }

    const updatedBrand = await prisma.brand.update({
      where: { id },
      data: {
        name: data.name.trim(),
        slug,
        description: data.description?.trim() || null,
        logoId: data.logoId || null,
      },
    });

    revalidatePath("/admin/brands");
    return { success: true, brand: updatedBrand };
  } catch (error: any) {
    console.error("Error updating brand:", error);
    return { success: false, error: error.message || "Failed to update brand" };
  }
}

export async function deleteBrand(id: string) {
  try {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!brand) {
      throw new Error("Brand not found");
    }

    if (brand._count.products > 0) {
      throw new Error(
        `Cannot delete brand "${brand.name}". It is associated with ${brand._count.products} products.`
      );
    }

    await prisma.brand.delete({
      where: { id },
    });

    revalidatePath("/admin/brands");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting brand:", error);
    return { success: false, error: error.message || "Failed to delete brand" };
  }
}
