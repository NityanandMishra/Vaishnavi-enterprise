"use server";

import { prisma } from "@/lib/db";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";

export async function getImages() {
  try {
    const images = await prisma.mediaImage.findMany({
      include: {
        _count: {
          select: {
            products: true,
            brands: true,
            categories: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      images: images.map((img) => ({
        ...img,
        usedCount: img._count.products + img._count.brands + img._count.categories,
      })),
    };
  } catch (error: any) {
    console.error("Error fetching images:", error);
    return { success: false, error: error.message || "Failed to fetch images" };
  }
}

export async function uploadImage(formData: FormData) {
  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      throw new Error("No file provided");
    }

    const alt = (formData.get("alt") as string) || file.name.split(".")[0];
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${Date.now()}_${uniqueId}_${sanitizedName}`;

    // Upload directory path
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    // Write file
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${filename}`;

    // Create record in DB
    const mediaImage = await prisma.mediaImage.create({
      data: {
        url: fileUrl,
        filename: file.name,
        size: file.size,
        alt: alt,
      },
    });

    revalidatePath("/admin/images");

    return { success: true, image: mediaImage };
  } catch (error: any) {
    console.error("Error uploading image:", error);
    return { success: false, error: error.message || "Failed to upload image" };
  }
}

export async function deleteImage(id: string) {
  try {
    const image = await prisma.mediaImage.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            brands: true,
            categories: true,
          },
        },
      },
    });

    if (!image) {
      throw new Error("Image not found");
    }

    const usedCount = image._count.products + image._count.brands + image._count.categories;
    if (usedCount > 0) {
      throw new Error(`Image is in use by ${usedCount} items and cannot be deleted.`);
    }

    // Try deleting file on disk
    if (image.url.startsWith("/uploads/")) {
      const filename = image.url.replace("/uploads/", "");
      const filePath = path.join(process.cwd(), "public", "uploads", filename);
      try {
        await unlink(filePath);
      } catch (err) {
        console.warn("File was not found on disk, deleting from database anyway:", filePath);
      }
    }

    // Delete from database
    await prisma.mediaImage.delete({
      where: { id },
    });

    revalidatePath("/admin/images");

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting image:", error);
    return { success: false, error: error.message || "Failed to delete image" };
  }
}
