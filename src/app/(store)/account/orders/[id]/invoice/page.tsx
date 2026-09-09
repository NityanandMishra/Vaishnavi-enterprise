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

  const [order, taxSettings] = await Promise.all([
    prisma.order.findUnique({
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
    }),
    prisma.taxSettings.findFirst(),
  ]);

  if (!order || order.userId !== userId) {
    notFound();
  }

  let address: Record<string, any> = {};
  try {
    address = JSON.parse(order.shippingAddress);
  } catch (_) {}

  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalCgst = order.items.reduce((sum, item) => sum + (item.cgstAmount ?? 0), 0);
  const totalSgst = order.items.reduce((sum, item) => sum + (item.sgstAmount ?? 0), 0);
  const totalIgst = order.items.reduce((sum, item) => sum + (item.igstAmount ?? 0), 0);
  const totalCess = order.items.reduce((sum, item) => sum + (item.cessAmount ?? 0), 0);
  const totalSnapshotTax = totalCgst + totalSgst + totalIgst + totalCess;
  const gstAmount = totalSnapshotTax > 0 ? totalSnapshotTax : Math.round(subtotal * 0.18);

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
      state: taxSettings?.sellerStateCode === "09" ? "Uttar Pradesh" : "Maharashtra",
      pincode: "221404",
      gstin: taxSettings?.sellerGstin || "09AAEPV1234F1Z5",
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
      hsnCode: item.hsnCode || item.product.hsnCode || item.product.category?.hsnCode || "8536",
      quantity: item.quantity,
      price: item.price,
      taxableValue: item.taxableValue ?? undefined,
      gstRate: item.gstRate ?? undefined,
      cgstAmount: item.cgstAmount ?? undefined,
      sgstAmount: item.sgstAmount ?? undefined,
      igstAmount: item.igstAmount ?? undefined,
      cessAmount: item.cessAmount ?? undefined,
    })),
    subtotal,
    discountAmount: order.discountAmount || 0,
    couponCode: order.couponCode,
    shippingCost: order.shippingCost || 0,
    gstAmount,
    totalAmount: order.totalAmount,
    cgstTotal: totalCgst,
    sgstTotal: totalSgst,
    igstTotal: totalIgst,
    cessTotal: totalCess,
  };

  return <InvoiceView invoice={invoiceData} backHref={`/account/orders/${order.id}`} />;
}
