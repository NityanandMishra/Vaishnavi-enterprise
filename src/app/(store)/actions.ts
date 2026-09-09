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
import { calculateTax, roundPaisa } from "@/lib/tax/tax-engine";
import { getStateCodeByName } from "@/lib/tax/indian-states";

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

/**
 * Solar consultancy inquiry.
 *
 * Distinct from submitLead, which requires an existing productId — a solar
 * enquiry is about a service, so it lands in the same Lead queue with a
 * synthetic productName and the qualification answers folded into `message`,
 * where /admin/leads already renders them.
 */
const SOLAR_INTERESTS = {
  ROOFTOP: "Rooftop solar for home",
  LIGHTING: "Solar lighting",
  UNSURE: "Needs advice",
} as const;

const solarInquirySchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  city: z.string().trim().min(2, "Please enter your city.").max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
  interest: z.enum(["ROOFTOP", "LIGHTING", "UNSURE"]),
  propertyType: z.string().trim().max(60).optional().or(z.literal("")),
  monthlyBill: z.string().trim().max(40).optional().or(z.literal("")),
  roofArea: z.string().trim().max(40).optional().or(z.literal("")),
  timeline: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function submitSolarInquiry(_prev: unknown, formData: FormData) {
  const parsed = solarInquirySchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    city: formData.get("city"),
    pincode: formData.get("pincode"),
    interest: formData.get("interest"),
    propertyType: formData.get("propertyType") ?? "",
    monthlyBill: formData.get("monthlyBill") ?? "",
    roofArea: formData.get("roofArea") ?? "",
    timeline: formData.get("timeline") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const d = parsed.data;

  // The bill band is captured for our own sizing; it is never shown back to the
  // customer, since the real number comes out of the site survey.
  const summary = [
    `Interest: ${SOLAR_INTERESTS[d.interest]}`,
    d.propertyType && `Property: ${d.propertyType}`,
    d.monthlyBill && `Monthly bill: ${d.monthlyBill}`,
    d.roofArea && `Roof area: ${d.roofArea}`,
    d.timeline && `Timeline: ${d.timeline}`,
    d.notes && `Notes: ${d.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  const lead = await prisma.lead.create({
    data: {
      name: d.name,
      phone: d.phone,
      email: d.email || null,
      city: d.city,
      pincode: d.pincode,
      message: summary,
      productId: null,
      productName: `Solar enquiry — ${SOLAR_INTERESTS[d.interest]}`,
      sourceUrl: "/solar",
    },
  });

  return { ok: true as const, reference: lead.id.slice(0, 8).toUpperCase() };
}

/** Placeholder serviceability check — every Indian pincode is treated as deliverable. */
export async function checkPincode(pincode: string) {
  if (!/^\d{6}$/.test(pincode)) {
    return { ok: false as const, error: "Enter a valid 6-digit pincode." };
  }
  return { ok: true as const, deliverable: true, etaDays: "2–5 business days" };
}

// ─── COUPON VALIDATION ────────────────────────────────────────────────────────

export async function validateCoupon(code: string, subtotal: number) {
  if (!code || !code.trim()) {
    return { ok: false as const, error: "Please enter a coupon code." };
  }

  const cleanCode = code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({
    where: { code: cleanCode },
  });

  if (!coupon || !coupon.isActive || coupon.deletedAt) {
    return { ok: false as const, error: `Coupon code "${cleanCode}" is invalid or expired.` };
  }

  if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
    return { ok: false as const, error: `Coupon code "${cleanCode}" has expired.` };
  }

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false as const, error: `Coupon code "${cleanCode}" usage limit has been reached.` };
  }

  if (subtotal < coupon.minOrderValue) {
    return {
      ok: false as const,
      error: `Minimum order value for ${cleanCode} is ₹${coupon.minOrderValue.toLocaleString("en-IN")}.`,
    };
  }

  let discount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discount = Math.round((subtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else {
    discount = Math.min(coupon.discountValue, subtotal);
  }

  return {
    ok: true as const,
    code: coupon.code,
    discount,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    message:
      coupon.discountType === "PERCENTAGE"
        ? `${coupon.discountValue}% off applied! (Saved ₹${discount.toLocaleString("en-IN")})`
        : `Flat ₹${discount.toLocaleString("en-IN")} discount applied!`,
  };
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
  couponCode: z.string().trim().optional().or(z.literal("")),
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
    couponCode: formData.get("couponCode") ?? "",
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const cart = await getOrCreateCart();
  if (cart.items.length === 0) {
    return { ok: false as const, error: "Your cart is empty." };
  }

  // Fetch active TaxSettings singleton
  const taxSettings = await prisma.taxSettings.findFirst({
    include: {
      defaultHsn: {
        include: {
          rateVersions: {
            orderBy: [{ effectiveFrom: "desc" }],
            include: { slabs: true },
          },
        },
      },
    },
  });

  const sellerStateCode = taxSettings?.sellerStateCode || "27";
  const deliveryStateCode = getStateCodeByName(parsed.data.state, sellerStateCode);
  const pricingMode = (taxSettings?.pricingMode || "EXCLUSIVE") as "EXCLUSIVE" | "INCLUSIVE";

  const rawLines = cart.items.map((item) => ({
    item,
    productId: item.productId,
    variantId: item.variantId,
    productTitle: item.product.title,
    variantTitle: item.variant?.title ?? null,
    quantity: item.quantity,
    price: lineItemPrice(item.product.basePrice, item.variant?.price),
  }));

  const subtotal = rawLines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  // Validate discount if coupon provided
  let discountAmount = 0;
  let appliedCouponCode: string | null = null;

  if (parsed.data.couponCode) {
    const couponValidation = await validateCoupon(parsed.data.couponCode, subtotal);
    if (couponValidation.ok) {
      discountAmount = couponValidation.discount;
      appliedCouponCode = couponValidation.code;
    }
  }

  // Pre-fetch any HSN codes if product only has hsnCode string and no hsnRel
  const unlinkedHsnCodes = Array.from(
    new Set(
      cart.items
        .filter(
          (i) =>
            !i.product.hsnRel &&
            !i.product.category?.hsnMapping?.hsn &&
            !i.product.category?.parent?.hsnMapping?.hsn &&
            i.product.hsnCode
        )
        .map((i) => i.product.hsnCode as string)
    )
  );

  const extraHsnRecords =
    unlinkedHsnCodes.length > 0
      ? await prisma.hsnCode.findMany({
          where: { code: { in: unlinkedHsnCodes }, deletedAt: null },
          include: {
            rateVersions: {
              orderBy: [{ effectiveFrom: "desc" }],
              include: { slabs: true },
            },
          },
        })
      : [];
  const extraHsnMap = new Map(extraHsnRecords.map((h) => [h.code, h]));

  // Calculate taxes per line with GST engine
  const lines = rawLines.map(({ item, productId, variantId, productTitle, variantTitle, quantity, price }) => {
    let resolvedHsn: any = null;
    if (item.product.hsnRel && !item.product.hsnRel.deletedAt) {
      resolvedHsn = item.product.hsnRel;
    } else if (item.product.category?.hsnMapping?.hsn && !item.product.category.hsnMapping.hsn.deletedAt) {
      resolvedHsn = item.product.category.hsnMapping.hsn;
    } else if (item.product.category?.parent?.hsnMapping?.hsn && !item.product.category.parent.hsnMapping.hsn.deletedAt) {
      resolvedHsn = item.product.category.parent.hsnMapping.hsn;
    } else if (item.product.hsnCode && extraHsnMap.has(item.product.hsnCode)) {
      resolvedHsn = extraHsnMap.get(item.product.hsnCode);
    } else if (taxSettings?.defaultHsn && !taxSettings.defaultHsn.deletedAt) {
      resolvedHsn = taxSettings.defaultHsn;
    } else {
      resolvedHsn = {
        code: "8536",
        description: "Electrical apparatus",
        rateType: "FLAT",
        cessRate: 0,
        rateVersions: [{ id: "fallback-v1", gstRate: 18, effectiveFrom: new Date(), effectiveTo: null }],
      };
    }

    const itemSubtotal = price * quantity;
    const itemDiscount = subtotal > 0 ? (itemSubtotal / subtotal) * discountAmount : 0;
    const discountPerUnit = quantity > 0 ? itemDiscount / quantity : 0;

    const taxResult = calculateTax({
      unitPrice: price,
      quantity,
      discountPerUnit,
      hsn: resolvedHsn,
      sellerStateCode,
      deliveryStateCode,
      pricingMode,
    });

    return {
      productId,
      variantId,
      productTitle,
      variantTitle,
      quantity,
      price,
      hsnCode: resolvedHsn.code,
      gstRate: taxResult.gstRate,
      cgstAmount: taxResult.cgstAmount,
      sgstAmount: taxResult.sgstAmount,
      igstAmount: taxResult.igstAmount,
      cessAmount: taxResult.cessAmount,
      taxableValue: taxResult.taxableValue,
      lineTotal: taxResult.lineTotal,
    };
  });

  const totalLineTaxes = lines.reduce(
    (sum, l) => sum + l.cgstAmount + l.sgstAmount + l.igstAmount + l.cessAmount,
    0
  );
  const totalTaxable = lines.reduce((sum, l) => sum + l.taxableValue, 0);

  const finalTotal =
    pricingMode === "INCLUSIVE"
      ? roundPaisa(lines.reduce((sum, l) => sum + l.lineTotal, 0))
      : roundPaisa(totalTaxable + totalLineTaxes);

  // Generate order ID
  const orderId = crypto.randomUUID();

  // Atomically reserve stock for tracked variants (EPIC-04: INV-03, FR-13)
  const reservationLines = lines
    .filter((l) => l.variantId)
    .map((l) => ({
      variantId: l.variantId!,
      quantity: l.quantity,
      productTitle: l.productTitle,
      variantTitle: l.variantTitle,
    }));

  if (reservationLines.length > 0) {
    try {
      const { reserveStock } = await import("@/lib/inventory/inventory-service");
      await reserveStock({
        orderId,
        items: reservationLines,
      });
    } catch (err: any) {
      return {
        ok: false as const,
        error:
          err.message ||
          "One or more items in your cart are no longer available in the requested quantity.",
      };
    }
  }

  // Razorpay capture happens here once the gateway is wired up.
  const order = await prisma.order.create({
    data: {
      id: orderId,
      userId,
      status: parsed.data.paymentMethod === "COD" ? "COD_CONFIRMED" : "PENDING",
      totalAmount: finalTotal,
      discountAmount,
      couponCode: appliedCouponCode,
      paymentMethod: parsed.data.paymentMethod,
      deliveryZone: deliveryStateCode === "09" ? "UP" : "PAN_INDIA",
      shippingAddress: JSON.stringify(parsed.data),
      items: {
        create: lines.map(({ lineTotal, productTitle, ...itemData }) => itemData),
      },
    },
  });

  // Increment coupon usage count if applied
  if (appliedCouponCode) {
    await prisma.coupon.update({
      where: { code: appliedCouponCode },
      data: { usedCount: { increment: 1 } },
    });
  }

  // Also auto-save address to user's address book if not already saved
  const existingAddress = await prisma.address.findFirst({
    where: {
      userId,
      addressLine1: parsed.data.addressLine1,
      pincode: parsed.data.pincode,
    },
  });
  if (!existingAddress) {
    await prisma.address.create({
      data: {
        userId,
        fullName: parsed.data.fullName,
        addressLine1: parsed.data.addressLine1,
        addressLine2: parsed.data.addressLine2 || null,
        city: parsed.data.city,
        state: parsed.data.state,
        pincode: parsed.data.pincode,
        alternatePhone: parsed.data.phone,
        isDefault: false,
      },
    });
  }

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  revalidatePath("/cart");
  revalidatePath("/account");
  redirect(`/account/orders/${order.id}`);
}

// ─── ADDRESS MANAGEMENT ACTIONS ──────────────────────────────────────────────

export async function saveAddress(_prev: unknown, formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, error: "Please sign in to save addresses." };

  const id = formData.get("id") as string | null;
  const fullName = (formData.get("fullName") as string)?.trim();
  const addressLine1 = (formData.get("addressLine1") as string)?.trim();
  const addressLine2 = (formData.get("addressLine2") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim();
  const state = (formData.get("state") as string)?.trim();
  const pincode = (formData.get("pincode") as string)?.trim();
  const alternatePhone = (formData.get("alternatePhone") as string)?.trim() || null;
  const isDefault = formData.get("isDefault") === "true";

  if (!fullName || !addressLine1 || !city || !state || !pincode) {
    return { ok: false as const, error: "Please fill in all required address fields." };
  }

  if (!/^\d{6}$/.test(pincode)) {
    return { ok: false as const, error: "Please enter a valid 6-digit pincode." };
  }

  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  if (id) {
    await prisma.address.update({
      where: { id, userId },
      data: {
        fullName,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        alternatePhone,
        isDefault,
      },
    });
  } else {
    await prisma.address.create({
      data: {
        userId,
        fullName,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        alternatePhone,
        isDefault,
      },
    });
  }

  revalidatePath("/account");
  return { ok: true as const };
}

export async function deleteAddress(addressId: string) {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, error: "Unauthorized" };

  await prisma.address.delete({
    where: { id: addressId, userId },
  });

  revalidatePath("/account");
  return { ok: true as const };
}

export async function setDefaultAddress(addressId: string) {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, error: "Unauthorized" };

  await prisma.address.updateMany({
    where: { userId },
    data: { isDefault: false },
  });

  await prisma.address.update({
    where: { id: addressId, userId },
    data: { isDefault: true },
  });

  revalidatePath("/account");
  return { ok: true as const };
}

// ─── PROFILE UPDATE ACTION ───────────────────────────────────────────────────

export async function updateProfile(_prev: unknown, formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, error: "Unauthorized" };

  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();

  if (!name) {
    return { ok: false as const, error: "Name cannot be blank." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      phone: phone || null,
    },
  });

  revalidatePath("/account");
  return { ok: true as const };
}

// ─── REVIEWS SUBMISSION ACTION ───────────────────────────────────────────────

export async function submitProductReview(_prev: unknown, formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, error: "Please sign in to write a review." };

  const productId = formData.get("productId") as string;
  const rating = Number(formData.get("rating"));
  const title = (formData.get("title") as string)?.trim() || null;
  const comment = (formData.get("comment") as string)?.trim();

  if (!productId || !comment || isNaN(rating) || rating < 1 || rating > 5) {
    return { ok: false as const, error: "Please provide a valid rating (1–5) and review comment." };
  }

  // Check if user has purchased this product before to award Verified Buyer badge
  const verifiedOrder = await prisma.order.findFirst({
    where: {
      userId,
      status: { in: ["CAPTURED", "COD_CONFIRMED", "FULFILLED", "DELIVERED"] },
      items: {
        some: { productId },
      },
    },
  });

  const review = await prisma.review.create({
    data: {
      userId,
      productId,
      rating,
      title,
      comment,
      isVerifiedPurchase: !!verifiedOrder,
      status: "APPROVED",
    },
  });

  revalidatePath(`/products/${productId}`);
  return { ok: true as const, reviewId: review.id };
}

