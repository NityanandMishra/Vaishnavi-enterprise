import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/db";
import TaxNavTabs from "./TaxNavTabs";

export default async function TaxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const role = ((session?.user as any)?.role || "ADMIN") as string;

  // Calculate unmapped categories count for the tab badge
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    include: {
      hsnMapping: true,
      parent: {
        include: { hsnMapping: true },
      },
    },
  });

  const unmappedCount = categories.filter(
    (c) => !c.hsnMapping && !c.parent?.hsnMapping
  ).length;

  return (
    <div className="flex flex-col min-h-full">
      <TaxNavTabs unmappedCategoriesCount={unmappedCount} userRole={role} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
