import { prisma } from "@/lib/db";

export type NavSubcategory = { id: string; name: string; slug: string };
export type NavCategory = NavSubcategory & { children: NavSubcategory[] };

/** How many categories may ever appear inline in the header bar. */
export const PINNED_LIMIT = 3;

/**
 * Categories for the storefront header.
 *
 * A nav entry has to lead somewhere, so a top-level category qualifies only if
 * it holds products itself or has a subcategory that does — the same rule
 * already applied to subcategory chips and brand facets. Without it the menu
 * would list placeholder categories that open an empty listing.
 *
 * Note the header renders a fixed number of inline slots regardless of how many
 * categories come back: everything beyond PINNED_LIMIT lives in the mega-menu,
 * so adding categories can never grow the header.
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
        where: { products: { some: {} } },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return categories;
}
