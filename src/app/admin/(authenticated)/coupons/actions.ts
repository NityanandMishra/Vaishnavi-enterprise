"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const role = (user as any)?.role;
  if (!session || !user || (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "CATALOG_MANAGER")) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function createAdminCoupon(formData: FormData) {
  const user = await requireAdmin();

  const code = (formData.get("code") as string)?.trim().toUpperCase();
  const discountType = formData.get("discountType") as string;
  const discountValue = parseFloat(formData.get("discountValue") as string);
  const minOrderValue = parseFloat(formData.get("minOrderValue") as string) || 0;
  const maxDiscountRaw = formData.get("maxDiscount") as string;
  const maxDiscount = maxDiscountRaw ? parseFloat(maxDiscountRaw) : null;
  const usageLimitRaw = formData.get("usageLimit") as string;
  const usageLimit = usageLimitRaw ? parseInt(usageLimitRaw, 10) : null;
  const expiresAtRaw = formData.get("expiresAt") as string;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  if (!code || isNaN(discountValue) || discountValue <= 0) {
    return { ok: false, error: "Please provide a valid coupon code and discount value." };
  }

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) {
    return { ok: false, error: `Coupon code "${code}" already exists.` };
  }

  const coupon = await prisma.coupon.create({
    data: {
      code,
      discountType: discountType === "FLAT" ? "FLAT" : "PERCENTAGE",
      discountValue,
      minOrderValue,
      maxDiscount,
      usageLimit,
      expiresAt,
      isActive: true,
    },
  });

  // Log to Audit trail
  await prisma.auditLog.create({
    data: {
      actorId: (user as any).id || "admin",
      actorName: user.name || "Admin",
      actorRole: (user as any).role || "ADMIN",
      entity: "COUPON",
      entityId: coupon.id,
      action: `Created coupon ${code} (${discountType} ${discountValue})`,
      afterState: JSON.stringify(coupon),
    },
  });

  revalidatePath("/admin/coupons");
  return { ok: true, coupon };
}

export async function toggleCouponActive(id: string, currentStatus: boolean) {
  const user = await requireAdmin();

  const updated = await prisma.coupon.update({
    where: { id },
    data: { isActive: !currentStatus },
  });

  // Log to Audit trail
  await prisma.auditLog.create({
    data: {
      actorId: (user as any).id || "admin",
      actorName: user.name || "Admin",
      actorRole: (user as any).role || "ADMIN",
      entity: "COUPON",
      entityId: id,
      action: `${!currentStatus ? "Activated" : "Deactivated"} coupon ${updated.code}`,
    },
  });

  revalidatePath("/admin/coupons");
  return { ok: true };
}

export async function deleteCoupon(id: string) {
  const user = await requireAdmin();

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) return { ok: false, error: "Coupon not found" };

  await prisma.coupon.delete({ where: { id } });

  // Log to Audit trail
  await prisma.auditLog.create({
    data: {
      actorId: (user as any).id || "admin",
      actorName: user.name || "Admin",
      actorRole: (user as any).role || "ADMIN",
      entity: "COUPON",
      entityId: id,
      action: `Deleted coupon ${coupon.code}`,
    },
  });

  revalidatePath("/admin/coupons");
  return { ok: true };
}
