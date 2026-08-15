"use server";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import { CART_COOKIE, cartInclude, cartTotals, lineItemPrice } from "@/lib/cart";

async function currentUserId(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id;
}

/** Resolves the active cart, creating one (and its cookie) when absent. */
async function getOrCreateCart() {
  const store = cookies();
  const userId = await currentUserId();

  if (userId) {
    const existing = await prisma.cart.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: cartInclude,
    });
    if (existing) return existing;
  }

  const token = store.get(CART_COOKIE)?.value;
  if (token) {
    const existing = await prisma.cart.findUnique({ where: { token }, include: cartInclude });
    if (existing) {
      // A guest who just signed in keeps their basket.
      if (userId && !existing.userId) {
        return prisma.cart.update({
          where: { id: existing.id },
          data: { userId },
          include: cartInclude,
        });
      }
      return existing;
    }
  }

  const newToken = randomUUID();
  store.set(CART_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return prisma.cart.create({
    data: { token: newToken, userId },
    include: cartInclude,
  });
}

const addToCartSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(99),
});

export async function addToCart(input: {
  productId: string;
  variantId?: string;
  quantity: number;
}) {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid request." };

  const { productId, variantId, quantity } = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.isAvailable) {
    return { ok: false as const, error: "This product is not available." };
  }
  if (product.checkoutMode === "INQUIRE") {
    return { ok: false as const, error: "This product is inquiry-only." };
  }

  const cart = await getOrCreateCart();
  const existing = cart.items.find(
    (i) => i.productId === productId && i.variantId === (variantId ?? null)
  );

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: Math.min(99, existing.quantity + quantity) },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId, variantId: variantId ?? null, quantity },
    });
  }

  revalidatePath("/cart");
  return { ok: true as const };
}

export async function updateCartItemQuantity(itemId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return { ok: false as const, error: "Invalid quantity." };
  }

  const cart = await getOrCreateCart();
  if (!cart.items.some((i) => i.id === itemId)) {
    return { ok: false as const, error: "Item not found in your cart." };
  }

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  revalidatePath("/cart");
  return { ok: true as const };
}

export async function removeCartItem(itemId: string) {
  const cart = await getOrCreateCart();
  if (!cart.items.some((i) => i.id === itemId)) {
    return { ok: false as const, error: "Item not found in your cart." };
  }

  await prisma.cartItem.delete({ where: { id: itemId } });
  revalidatePath("/cart");
  return { ok: true as const };
}

export async function toggleWishlistItem(productId: string) {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, error: "SIGN_IN_REQUIRED" };

  const existing = await prisma.wishlistItem.findFirst({ where: { userId, productId } });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/wishlist");
    return { ok: true as const, saved: false };
  }

  await prisma.wishlistItem.create({ data: { userId, productId } });
  revalidatePath("/wishlist");
  return { ok: true as const, saved: true };
}

const leadSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit pincode.").optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
  productId: z.string().min(1),
});

export async function submitLead(_prev: unknown, formData: FormData) {
  const parsed = leadSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    city: formData.get("city") ?? "",
    pincode: formData.get("pincode") ?? "",
    message: formData.get("message") ?? "",
    productId: formData.get("productId"),
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, title: true },
  });
  if (!product) return { ok: false as const, error: "Product not found." };

  await prisma.lead.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      city: parsed.data.city || null,
      pincode: parsed.data.pincode || null,
      message: parsed.data.message || null,
      productId: product.id,
      productName: product.title,
      sourceUrl: `/products/${product.id}`,
    },
  });

  return { ok: true as const };
}

/** Placeholder serviceability check — every Indian pincode is treated as deliverable. */
export async function checkPincode(pincode: string) {
  if (!/^\d{6}$/.test(pincode)) {
    return { ok: false as const, error: "Enter a valid 6-digit pincode." };
  }
  return { ok: true as const, deliverable: true, etaDays: "2–5 business days" };
}

const placeOrderSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid mobile number."),
  addressLine1: z.string().trim().min(4).max(160),
  addressLine2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
  paymentMethod: z.enum(["RAZORPAY", "COD"]),
});

export async function placeOrder(_prev: unknown, formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, error: "Please sign in to place an order." };

  const parsed = placeOrderSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2") ?? "",
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
    paymentMethod: formData.get("paymentMethod"),
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const cart = await getOrCreateCart();
  if (cart.items.length === 0) {
    return { ok: false as const, error: "Your cart is empty." };
  }

  const lines = cart.items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    variantTitle: item.variant?.title ?? null,
    quantity: item.quantity,
    price: lineItemPrice(item.product.basePrice, item.variant?.price),
  }));

  const { total } = cartTotals(lines);

  // Razorpay capture happens here once the gateway is wired up.
  const order = await prisma.order.create({
    data: {
      userId,
      status: parsed.data.paymentMethod === "COD" ? "COD_CONFIRMED" : "PENDING",
      totalAmount: total,
      paymentMethod: parsed.data.paymentMethod,
      deliveryZone: parsed.data.state.toLowerCase().includes("uttar pradesh") ? "UP" : "PAN_INDIA",
      shippingAddress: JSON.stringify(parsed.data),
      items: { create: lines },
    },
  });

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  revalidatePath("/cart");
  revalidatePath("/account");
  redirect(`/account/orders/${order.id}`);
}
