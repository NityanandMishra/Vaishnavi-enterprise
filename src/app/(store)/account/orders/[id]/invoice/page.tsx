import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import InvoiceView, { InvoiceData } from "@/components/store/InvoiceView";
import type { InvoiceDataPayload } from "@/lib/orders/invoice-generator";

export const metadata: Metadata = {
  title: "Tax Invoice",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: "Paid",
  PARTIALLY_PAID: "Partially paid",
  PENDING: "Pending",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  FAILED: "Failed",
};

/**
 * Shows the stored GST invoice exactly as issued when the order shipped (ORD-11).
 * Nothing is recomputed here: no invoice row means no invoice yet.
 */
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
    select: {
      id: true,
      userId: true,
      orderNumber: true,
      paymentMethod: true,
      paymentStatus: true,
      couponCode: true,
      razorpayPaymentId: true,
      invoice: { select: { invoiceData: true } },
    },
  });

  if (!order || order.userId !== userId) {
    notFound();
  }

  const backHref = `/account/orders/${order.id}`;

  if (!order.invoice) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <FileText size={40} className="mx-auto text-slate-400" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">Invoice not available yet</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your GST tax invoice will be available once your order ships.
        </p>
        <Link
          href={backHref}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Back to order
        </Link>
      </div>
    );
  }

  const issued = JSON.parse(order.invoice.invoiceData) as InvoiceDataPayload;
  const address = issued.buyer.shippingAddress || {};

  const invoiceData: InvoiceData = {
    invoiceNumber: issued.invoiceNumber,
    orderId: order.id,
    orderNumber: issued.orderNumber,
    orderDate: issued.date, // shown as the invoice date
    paymentMethod: order.paymentMethod === "COD" ? "Cash on Delivery" : "Online payment",
    paymentStatus: PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus,
    transactionId: order.razorpayPaymentId || null,
    seller: {
      name: issued.seller.name,
      tradeName: issued.seller.tradeName || "",
      address: issued.seller.address,
      city: issued.seller.city,
      state: issued.seller.state,
      pincode: issued.seller.pincode,
      gstin: issued.seller.gstin,
      phone: issued.seller.phone,
      email: issued.seller.email,
    },
    buyer: {
      name: issued.buyer.name,
      phone: issued.buyer.phone || undefined,
      email: issued.buyer.email || undefined,
      addressLine1: address.addressLine1 || "",
      addressLine2: address.addressLine2 || null,
      city: address.city || "",
      state: issued.buyer.deliveryState,
      pincode: address.pincode || "",
    },
    items: issued.items.map((item) => ({
      id: item.id,
      title: item.productName,
      variantTitle: item.variantTitle,
      hsnCode: item.hsnCode,
      quantity: item.quantity,
      price: item.unitPrice,
      taxableValue: item.taxableValue,
      gstRate: item.gstRate,
      cgstAmount: item.cgstAmount,
      sgstAmount: item.sgstAmount,
      igstAmount: item.igstAmount,
      cessAmount: item.cessAmount,
    })),
    subtotal: issued.subtotal,
    discountAmount: issued.discount || 0,
    couponCode: order.couponCode,
    shippingCost: issued.shipping || 0,
    gstAmount: issued.cgstTotal + issued.sgstTotal + issued.igstTotal + issued.cessTotal,
    totalAmount: issued.total,
    cgstTotal: issued.cgstTotal,
    sgstTotal: issued.sgstTotal,
    igstTotal: issued.igstTotal,
    cessTotal: issued.cessTotal,
    taxableValueTotal: issued.taxableValue,
  };

  return <InvoiceView invoice={invoiceData} backHref={backHref} />;
}
