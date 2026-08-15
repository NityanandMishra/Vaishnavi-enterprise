import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ImageOff, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import Breadcrumbs from "@/components/store/Breadcrumbs";

export const metadata: Metadata = {
  title: "All Categories",
  description: "Browse every product category at Vaishnavi Enterprises.",
};

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    include: {
      image: true,
      children: { orderBy: { sortOrder: "asc" } },
      _count: { select: { products: true } },
    },
  });

  return (
    <div className="max-w-content mx-auto px-4 lg:px-8 pt-4 lg:pt-6 pb-4">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "All Categories" }]} />

      <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mt-4 mb-6">All Categories</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-surface border border-border-base rounded-lg p-4 flex flex-col">
            <Link href={`/categories/${cat.slug}`} className="group flex items-center gap-4">
              <div className="w-20 h-20 flex-shrink-0 bg-surface-alt rounded-md overflow-hidden relative">
                {cat.image ? (
                  <Image
                    src={cat.image.url}
                    alt={cat.image.alt ?? cat.name}
                    fill
                    className="object-contain p-2"
                    sizes="80px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff size={22} className="text-slate-300" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900 group-hover:text-brand-orange-600 transition-colors">
                  {cat.name}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {cat._count.products} {cat._count.products === 1 ? "product" : "products"}
                  {cat.defaultCheckoutMode === "INQUIRE" && " · Inquiry based"}
                </p>
              </div>
            </Link>

            {cat.children.length > 0 && (
              <ul className="mt-4 pt-3 border-t border-border-base space-y-0.5">
                {cat.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/categories/${child.slug}`}
                      className="flex items-center justify-between min-h-[40px] px-2 -mx-2 rounded-md text-sm text-slate-600 hover:text-slate-900 hover:bg-surface-alt transition-colors"
                    >
                      {child.name}
                      <ChevronRight size={15} className="text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
