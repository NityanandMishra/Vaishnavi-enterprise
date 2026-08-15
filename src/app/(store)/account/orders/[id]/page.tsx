import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import {
  ArrowLeft,
  ImageOff,
  MapPin,
  CreditCard,
  MessageCircle,
  CheckCircle2,
  Truck,
  Package,
  Clock,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import { formatINR, ownerWhatsAppUrl } from "@/lib/utils";
import { GST_RATE } from "@/lib/cart";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Order Details" };

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-warning/10 text-warning" },
  CAPTURED: { label: "Paid", className: "bg-success/10 text-success" },
  COD_CONFIRMED: { label: "COD Confirmed", className: "bg-success/10 text-success" },
  FULFILLED: { label: "Shipped", className: "bg-surface-sunken text-slate-700" },
  DELIVERED: { label: "Delivered", className: "bg-success/10 text-success" },
  CANCELLED: { label: "Cancelled", className: "bg-danger/10 text-danger" },
  REFUNDED: { label: "Refunded", className: "bg-slate-200 text-slate-700" },
};

/** Which timeline steps this order has reached. */
function timelineFor(status: string, createdAt: Date) {
  const paid = ["CAPTURED", "COD_CONFIRMED", "FULFILLED", "DELIVERED"].includes(status);
  const shipped = ["FULFILLED", "DELIVERED"].includes(status);
  const delivered = status === "DELIVERED";

  return [
    { label: "Order Placed", icon: CheckCircle2, done: true, detail: createdAt.toLocaleString("en-IN") },
    {
      label: status === "COD_CONFIRMED" ? "COD Confirmed" : "Payment Successful",
      icon: CheckCircle2,
      done: paid,
      detail: paid ? "Payment recorded" : "Awaiting payment",
    },
    { label: "Shipped", icon: Truck, done: shipped, detail: shipped ? "In transit" : "Not yet dispatched" },
    { label: "Delivered", icon: Package, done: delivered, detail: delivered ? "Delivered" : "Estimated 3–5 business days" },
  ];
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect(`/auth/login?callbackUrl=/account/orders/${params.id}`);

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                include: { image: true },
                orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!order || order.userId !== userId) notFound();

  const address = JSON.parse(order.shippingAddress) as Record<string, string>;
  const subtotal = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const gst = Math.round(subtotal * GST_RATE);
  const status = STATUS_LABELS[order.status] ?? {
    label: order.status,
    className: "bg-slate-200 text-slate-700",
  };
  const steps = timelineFor(order.status, order.createdAt);

  return (
    <div className="max-w-content mx-auto px-4 lg:px-8 pt-4 lg:pt-6 pb-4">
      <Link
        href="/account"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Account
      </Link>

      <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mt-3 mb-6">Order Details</h1>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:items-start space-y-4 lg:space-y-0">
        <div className="space-y-4">
          {/* Order header */}
          <div className="bg-surface border border-border-base rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Order ID</p>
                <p className="text-base font-bold text-slate-900 mt-0.5">
                  #{order.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <span
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md",
                  status.className
                )}
              >
                {status.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-4 border-t border-border-base">
              <span className="flex items-center gap-1.5 text-sm text-slate-600">
                <Clock size={15} />
                Placed on {order.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </span>
              <span className="text-lg font-bold text-brand-orange-600">
                {formatINR(order.totalAmount)}
              </span>
            </div>
          </div>

          {/* Tracking timeline */}
          <div className="bg-surface border border-border-base rounded-lg p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
              Track Package
            </h2>
            <ol className="space-y-0">
              {steps.map((step, i) => (
                <li key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                        step.done ? "bg-success text-white" : "bg-surface-alt text-muted"
                      )}
                    >
                      <step.icon size={15} />
                    </span>
                    {i < steps.length - 1 && (
                      <span
                        className={cn(
                          "w-0.5 flex-1 min-h-[28px]",
                          step.done ? "bg-success" : "bg-border-base"
                        )}
                      />
                    )}
                  </div>
                  <div className="pb-6">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        step.done ? "text-slate-900" : "text-muted"
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            {order.trackingNumber && (
              <p className="text-sm text-slate-600 pt-2 border-t border-border-base">
                Tracking ID:{" "}
                <span className="font-semibold text-slate-900">{order.trackingNumber}</span>
              </p>
            )}
          </div>

          {/* Items */}
          <div className="bg-surface border border-border-base rounded-lg p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
              Items ({order.items.length})
            </h2>
            <ul className="space-y-4">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <Link
                    href={`/products/${item.productId}`}
                    className="relative w-16 h-16 flex-shrink-0 bg-surface-alt rounded-md overflow-hidden"
                  >
                    {item.product.images[0] ? (
                      <Image
                        src={item.product.images[0].image.url}
                        alt=""
                        fill
                        className="object-contain p-1"
                        sizes="64px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff size={18} className="text-slate-300" />
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.productId}`}
                      className="text-sm font-semibold text-slate-900 leading-snug hover:text-brand-orange-600 transition-colors"
                    >
                      {item.product.title}
                    </Link>
                    {item.variantTitle && (
                      <p className="text-xs text-slate-600 mt-0.5">{item.variantTitle}</p>
                    )}
                    <p className="text-xs text-slate-600 mt-0.5">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 whitespace-nowrap">
                    {formatINR(item.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-5 pt-4 border-t border-border-base space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Subtotal</dt>
                <dd className="text-slate-900">{formatINR(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Shipping</dt>
                <dd className="font-medium text-success">
                  {order.shippingCost > 0 ? formatINR(order.shippingCost) : "Free"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Tax (GST 18%)</dt>
                <dd className="text-slate-900">{formatINR(gst)}</dd>
              </div>
              <div className="flex justify-between pt-2 border-t border-border-base">
                <dt className="text-base font-bold text-slate-900">Order Total</dt>
                <dd className="text-base font-bold text-slate-900">
                  {formatINR(order.totalAmount)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <div className="bg-surface border border-border-base rounded-lg p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted mb-3">
              <MapPin size={14} /> Shipping Address
            </h2>
            <p className="text-sm font-bold text-slate-900">{address.fullName}</p>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              {address.addressLine1}
              {address.addressLine2 && `, ${address.addressLine2}`}
              <br />
              {address.city}, {address.state} — {address.pincode}
              <br />
              Phone: {address.phone}
            </p>
          </div>

          <div className="bg-surface border border-border-base rounded-lg p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted mb-3">
              <CreditCard size={14} /> Payment Method
            </h2>
            <p className="text-sm font-bold text-slate-900">
              {order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment (Razorpay)"}
            </p>
          </div>

          <div className="bg-surface border border-dashed border-border-base rounded-lg p-6 text-center">
            <h2 className="text-base font-semibold text-slate-900 mb-1">
              Need help with this order?
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Our team is available to assist with technical queries or shipping delays.
            </p>
            <a
              href={ownerWhatsAppUrl(`Hi, I need help with order #${order.id.slice(0, 8).toUpperCase()}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-md bg-whatsapp text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 transition-opacity"
            >
              <MessageCircle size={17} /> WhatsApp Us
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
