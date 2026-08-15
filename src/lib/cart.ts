import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";

export const CART_COOKIE = "cart_token";

export const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      variant: true,
      product: {
        include: {
          brand: true,
          images: {
            include: { image: true },
            orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
            take: 1,
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

/** Read-only cart lookup — safe to call from server components. */
export async function getCart() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (userId) {
    const userCart = await prisma.cart.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: cartInclude,
    });
    if (userCart) return userCart;
  }

  const token = cookies().get(CART_COOKIE)?.value;
  if (!token) return null;

  return prisma.cart.findUnique({ where: { token }, include: cartInclude });
}

/** The price actually charged for a line — variant price wins over base price. */
export function lineItemPrice(basePrice: number, variantPrice: number | null | undefined) {
  return variantPrice ?? basePrice;
}

export const GST_RATE = 0.18;

export function cartTotals(
  items: { quantity: number; price: number }[],
  shippingCost = 0
) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const gst = Math.round(subtotal * GST_RATE);
  return { subtotal, gst, shippingCost, total: subtotal + gst + shippingCost };
}
