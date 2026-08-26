import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import CouponsManager from "@/components/admin/CouponsManager";

export const metadata: Metadata = {
  title: "Admin — Coupons & Discounts",
};

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <CouponsManager coupons={coupons} />;
}
