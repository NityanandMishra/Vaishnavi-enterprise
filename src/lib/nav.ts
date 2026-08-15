import { prisma } from "@/lib/db";

export type NavSubcategory = {
  id: string;
  name: string;
  slug: string;
  /** Created by the admin but not yet stocked — shown, but not navigable. */
  comingSoon: boolean;
};
export type NavCategory = Omit<NavSubcategory, "comingSoon"> & {
  children: NavSubcategory[];
};

/** How many categories may ever appear inline in the header bar. */
export const PINNED_LIMIT = 3;

/**
 * Categories for the storefront header.
 *
 * Subcategories are listed whether or not they hold products. Hiding the empty
 * ones made the system look broken from the admin side — you create a
 * subcategory and it simply never shows up — so an unstocked one is surfaced
 * with a "Soon" tag and rendered inert instead of dropped.
 *
 * Top-level categories still have to lead somewhere: one that has no products
 * and no stocked subcategory is left out, which keeps placeholder rows out of
 * the primary navigation.
 *
 * The header renders a fixed number of inline slots regardless of what comes
 * back — everything past PINNED_LIMIT lives in the mega-menu — so category
 * count can never change the height of the bar.
 */
export async function getNavCategories(): Promise<NavCategory[]> {
  const categories = await prisma.category.findMany({
    where: {
      parentId: null,
      OR: [
        { products: { some: {} } },
        { children: { some: { products: { some: {} } } } },
      ],
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      children: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { products: true } },
        },
      },
    },
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    children: c.children.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      comingSoon: s._count.products === 0,
    })),
  }));
}
