import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import InvoiceView, { InvoiceData } from "@/components/store/InvoiceView";

export const metadata: Metadata = {
  title: "Tax Invoice",
};

export default async function CustomerOrderInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect(`/auth/login?callbackUrl=/account/orders/${params.id}/invoice`);

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
          variant: true,
        },
      },
    },
  });

  if (!order || order.userId !== userId) {
    notFound();
  }

  let address: Record<string, any> = {};
  try {
    address = JSON.parse(order.shippingAddress);
  } catch (_) {}

  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const gstAmount = Math.round(subtotal * 0.18);

  const invoiceData: InvoiceData = {
    invoiceNumber: `INV-${new Date(order.createdAt).getFullYear()}-${order.id.slice(0, 8).toUpperCase()}`,
    orderId: order.id,
    orderDate: order.createdAt,
    paymentMethod: order.paymentMethod === "COD" ? "Cash on Delivery" : "Online / UPI (Razorpay)",
    paymentStatus: order.status === "PENDING" ? "Pending" : "Confirmed / Paid",
    transactionId: order.razorpayPaymentId || order.razorpayOrderId || null,
    seller: {
      name: "Vaishnavi Enterprises",
      tradeName: "Vaishnavi Enterprises (Solar & Electrical Goods)",
      address: "Main Market, Suriyawan Road",
      city: "Suriyawan, Bhadohi",
      state: "Uttar Pradesh",
      pincode: "221404",
      gstin: "09AAEPV1234F1Z5",
      phone: "+91 73888 47575",
      email: "info@vaishnavienterprises.in",
    },
    buyer: {
      name: address.fullName || order.user.name || "Customer",
      phone: address.phone || address.alternatePhone || order.user.phone || undefined,
      email: order.user.email || undefined,
      addressLine1: address.addressLine1 || "Local Address",
      addressLine2: address.addressLine2 || null,
      city: address.city || "Suriyawan",
      state: address.state || "Uttar Pradesh",
      pincode: address.pincode || "221404",
    },
    items: order.items.map((item) => ({
      id: item.id,
      title: item.product.title,
      variantTitle: item.variantTitle || item.variant?.title || null,
      hsnCode: item.product.hsnCode || item.product.category?.hsnCode || "8541",
      quantity: item.quantity,
      price: item.price,
    })),
    subtotal,
    discountAmount: order.discountAmount || 0,
    couponCode: order.couponCode,
    shippingCost: order.shippingCost || 0,
    gstAmount,
    totalAmount: order.totalAmount,
  };

  return <InvoiceView invoice={invoiceData} backHref={`/account/orders/${order.id}`} />;
}
