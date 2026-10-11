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
  FileText,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Check,
  Building2,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import { formatINR, ownerWhatsAppUrl } from "@/lib/utils";
import { GST_RATE } from "@/lib/cart";
import { cn } from "@/lib/utils";
import CustomerOrderActions from "@/components/store/CustomerOrderActions";

export const metadata: Metadata = { title: "Order Details" };

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending Confirmation", className: "bg-warning/10 text-warning" },
  CONFIRMED: { label: "Confirmed", className: "bg-success/10 text-success" },
  PROCESSING: { label: "Processing & Allocation", className: "bg-blue-50 text-blue-700" },
  PACKED: { label: "Packed & Ready", className: "bg-purple-50 text-purple-700" },
  SHIPPED: { label: "Dispatched / In Transit", className: "bg-surface-sunken text-slate-700" },
  DELIVERED: { label: "Delivered", className: "bg-success/10 text-success" },
  CANCELLED: { label: "Cancelled", className: "bg-danger/10 text-danger" },
  RETURNED: { label: "Returned", className: "bg-slate-200 text-slate-700" },
  CAPTURED: { label: "Paid", className: "bg-success/10 text-success" },
  COD_CONFIRMED: { label: "COD Confirmed", className: "bg-success/10 text-success" },
  FULFILLED: { label: "Shipped", className: "bg-surface-sunken text-slate-700" },
  REFUNDED: { label: "Refunded", className: "bg-slate-200 text-slate-700" },
};

/** Which pipeline steps this order has reached if no external carrier events. */
function pipelineFor(status: string, createdAt: Date, confirmedAt?: Date | null, shippedAt?: Date | null, deliveredAt?: Date | null) {
  const isConfirmed = ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED", "CAPTURED", "COD_CONFIRMED", "FULFILLED"].includes(status);
  const isPacked = ["PACKED", "SHIPPED", "DELIVERED", "FULFILLED"].includes(status);
  const isShipped = ["SHIPPED", "DELIVERED", "FULFILLED"].includes(status);
  const isDelivered = status === "DELIVERED";

  return [
    {
      label: "Order Placed",
      icon: CheckCircle2,
      done: true,
      detail: createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    },
    {
      label: "Order Confirmed",
      icon: CheckCircle2,
      done: isConfirmed,
      detail: confirmedAt
        ? confirmedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        : isConfirmed
        ? "Confirmed by Sales Desk"
        : "Awaiting payment / confirmation",
    },
    {
      label: "Packed & Quality Inspected",
      icon: Package,
      done: isPacked,
      detail: isPacked ? "Packed at Bhadohi Logistics Center" : "Pending warehouse allocation",
    },
    {
      label: "Handed over to Courier",
      icon: Truck,
      done: isShipped,
      detail: shippedAt
        ? shippedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        : isShipped
        ? "In Transit with Courier"
        : "Pending dispatch handover",
    },
    {
      label: "Delivered",
      icon: Check,
      done: isDelivered,
      detail: deliveredAt
        ? deliveredAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        : isDelivered
        ? "Delivered to Customer"
        : "Estimated 3–5 business days",
    },
  ];
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect(`/auth/login?callbackUrl=/account/orders/${params.id}`);

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      invoice: true,
      transactions: {
        orderBy: { createdAt: "desc" },
      },
      shipments: {
        include: {
          courier: true,
          events: {
            orderBy: { eventAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
      },
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

  let address: Record<string, string> = {};
  try {
    address = JSON.parse(order.shippingAddress);
  } catch (_) {}

  const subtotal = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalCgst = order.items.reduce((sum, i) => sum + (i.cgstAmount ?? 0), 0);
  const totalSgst = order.items.reduce((sum, i) => sum + (i.sgstAmount ?? 0), 0);
  const totalIgst = order.items.reduce((sum, i) => sum + (i.igstAmount ?? 0), 0);
  const totalCess = order.items.reduce((sum, i) => sum + (i.cessAmount ?? 0), 0);
  const totalSnapshotTax = totalCgst + totalSgst + totalIgst + totalCess;
  const gst = totalSnapshotTax > 0 ? totalSnapshotTax : Math.round(subtotal * GST_RATE);
  const isIntraState = totalIgst === 0 && (totalCgst > 0 || totalSgst > 0);

  const status = STATUS_LABELS[order.status] ?? {
    label: order.status.replace(/_/g, " "),
    className: "bg-slate-200 text-slate-700",
  };

  const primaryShipment = order.shipments[0];
  const orderNumberFormatted = order.orderNumber || `#${order.id.slice(0, 8).toUpperCase()}`;
  const steps = pipelineFor(
    order.status,
    order.createdAt,
    order.confirmedAt,
    order.shippedAt,
    order.deliveredAt
  );

  return (
    <div className="wrap pt-6 pb-16">
      <Link
        href="/account"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--fg-muted)] hover:text-[var(--accent-ink)] transition-colors"
      >
        <ArrowLeft size={16} /> Back to My Account
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
            Order {orderNumberFormatted}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Placed on {order.createdAt.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {order.invoice?.invoiceNumber && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded">
              <FileText size={12} /> {order.invoice.invoiceNumber}
            </span>
          )}
          <span
            className={cn(
              "text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md",
              status.className
            )}
          >
            {status.label}
          </span>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:items-start space-y-6 lg:space-y-0">
        <div className="space-y-6">
          {/* ── Order Status & Self-Service Banner ── */}
          <CustomerOrderActions
            orderId={order.id}
            orderNumber={orderNumberFormatted}
            status={order.status}
            paymentMethod={order.paymentMethod}
            totalAmount={order.totalAmount}
          />

          {/* ── Live Shipment & Tracking Card ── */}
          <div className="bg-surface border border-border-base rounded-xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-border-base pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-brand-orange-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Package & Dispatch Tracking
                </h2>
              </div>
              {primaryShipment?.courier && (
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  {primaryShipment.courier.name}
                </span>
              )}
            </div>

            {primaryShipment ? (
              <div className="space-y-4">
                {/* AWB Banner */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Air Waybill (AWB) Tracking ID
                    </p>
                    <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                      {primaryShipment.awbNumber || order.trackingNumber || "Pending Generation"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Carrier: <strong>{primaryShipment.courier.name}</strong> · Status:{" "}
                      <span className="font-semibold text-slate-800">
                        {primaryShipment.status.replace(/_/g, " ")}
                      </span>
                    </p>
                  </div>

                  {(primaryShipment.awbNumber || order.trackingUrl) && (
                    <a
                      href={
                        order.trackingUrl ||
                        `https://www.delhivery.com/track/package/${primaryShipment.awbNumber}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors self-start sm:self-center"
                    >
                      <span>Track with Carrier</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {/* Real-time Checkpoints if available */}
                {primaryShipment.events && primaryShipment.events.length > 0 ? (
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                      Transit Checkpoints
                    </h3>
                    <ol className="relative border-l border-slate-200 ml-3 space-y-4 text-xs">
                      {primaryShipment.events.map((evt, idx) => (
                        <li key={evt.id} className="ml-4">
                          <span
                            className={cn(
                              "absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white",
                              idx === 0 ? "bg-emerald-500" : "bg-slate-300"
                            )}
                          />
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                            <p className="font-semibold text-slate-900">{evt.description}</p>
                            <time className="text-[11px] text-slate-400">
                              {evt.eventAt.toLocaleString("en-IN", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </time>
                          </div>
                          {evt.location && (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin size={11} /> {evt.location}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-md text-xs text-blue-900 flex items-start gap-2">
                    <Clock size={15} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>
                      Package handed over to <strong>{primaryShipment.courier.name}</strong>. Carrier telemetry will appear here as soon as the first transit hub scan is logged.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback to high-level fulfillment pipeline */
              <div>
                <p className="text-xs text-slate-500 mb-4">
                  Dispatched directly from Vaishnavi Enterprises Central Logistics Hub (Suriyawan Road, Bhadohi, UP).
                </p>
                <ol className="space-y-0">
                  {steps.map((step, i) => (
                    <li key={step.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                            step.done
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-400 border border-slate-200"
                          )}
                        >
                          <step.icon size={14} />
                        </span>
                        {i < steps.length - 1 && (
                          <span
                            className={cn(
                              "w-0.5 flex-1 min-h-[26px]",
                              step.done ? "bg-emerald-600" : "bg-slate-200"
                            )}
                          />
                        )}
                      </div>
                      <div className="pb-5">
                        <p
                          className={cn(
                            "text-xs font-bold",
                            step.done ? "text-slate-900" : "text-slate-400"
                          )}
                        >
                          {step.label}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                {order.trackingNumber && (
                  <div className="pt-3 border-t border-border-base flex items-center justify-between text-xs">
                    <span className="text-slate-500">Tracking Reference:</span>
                    <span className="font-mono font-bold text-slate-900">{order.trackingNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Order Items & Tax Summary ── */}
          <div className="bg-surface border border-border-base rounded-xl p-5 sm:p-6 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-4">
              Purchased Items ({order.items.length})
            </h2>

            <ul className="divide-y divide-border-base">
              {order.items.map((item) => (
                <li key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                  <Link
                    href={`/products/${item.productId}`}
                    className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-surface-alt rounded-lg overflow-hidden border border-border-base"
                  >
                    {item.product.images[0] ? (
                      <Image
                        src={item.product.images[0].image.url}
                        alt=""
                        fill
                        className="object-contain p-1"
                        sizes="(max-width: 640px) 64px, 80px"
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
                      className="text-sm font-bold text-slate-900 leading-snug hover:text-brand-orange-600 transition-colors line-clamp-2"
                    >
                      {item.product.title}
                    </Link>
                    {item.variantTitle && (
                      <p className="text-xs text-slate-500 mt-0.5">Variant: {item.variantTitle}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-600">
                      <span>Qty: <strong>{item.quantity}</strong></span>
                      <span>·</span>
                      <span>Unit: {formatINR(item.price)}</span>
                      {item.hsnCode && (
                        <span className="text-[10px] font-mono font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          HSN: {item.hsnCode}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-bold text-slate-900 whitespace-nowrap">
                    {formatINR(item.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-6 pt-4 border-t border-border-base space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-600">Taxable Subtotal</dt>
                <dd className="font-mono text-slate-900 font-semibold">{formatINR(subtotal)}</dd>
              </div>

              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <dt>Promo Coupon Discount ({order.couponCode || "APPLIED"})</dt>
                  <dd className="font-mono">-{formatINR(order.discountAmount)}</dd>
                </div>
              )}

              {totalSnapshotTax > 0 ? (
                <>
                  {isIntraState ? (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <dt>CGST (Central Tax 9%)</dt>
                        <dd className="font-mono">{formatINR(totalCgst)}</dd>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <dt>SGST (State Tax 9%)</dt>
                        <dd className="font-mono">{formatINR(totalSgst)}</dd>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-slate-600">
                      <dt>IGST (Integrated Tax 18%)</dt>
                      <dd className="font-mono">{formatINR(totalIgst)}</dd>
                    </div>
                  )}
                  {totalCess > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <dt>CESS</dt>
                      <dd className="font-mono">{formatINR(totalCess)}</dd>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <dt>GST (18% inclusive)</dt>
                  <dd className="font-mono">{formatINR(gst)}</dd>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <dt>Commercial Shipping</dt>
                <dd className="font-mono">
                  {order.shippingCost === 0 ? "FREE" : formatINR(order.shippingCost)}
                </dd>
              </div>

              <div className="flex justify-between pt-3 border-t-2 border-slate-900 text-sm font-bold text-slate-900">
                <dt>Order Grand Total</dt>
                <dd className="font-mono text-base text-brand-orange-600">
                  {formatINR(order.totalAmount)}
                </dd>
              </div>
            </dl>

            {/* Download Tax Invoice CTA Button */}
            <div className="mt-5 pt-4 border-t border-border-base flex flex-col sm:flex-row items-center gap-3">
              <Link
                href={`/account/orders/${order.id}/invoice`}
                className="w-full sm:flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
              >
                <FileText size={16} />
                <span>View & Print Official GST Invoice</span>
              </Link>
            </div>
          </div>

          {/* ── Payment Transactions Card ── */}
          <div className="bg-surface border border-border-base rounded-xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-border-base pb-3 mb-4">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-slate-700" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Payment History & Gateway Transactions
                </h2>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {order.paymentMethod}
              </span>
            </div>

            {order.transactions && order.transactions.length > 0 ? (
              <div className="space-y-3">
                {order.transactions.map((txn) => {
                  const isSuccess = ["PAID", "SUCCESS", "CAPTURED"].includes(txn.status);
                  const isFailed = txn.status === "FAILED";
                  const isPending = txn.status === "PENDING";

                  return (
                    <div
                      key={txn.id}
                      className={cn(
                        "p-4 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                        isSuccess
                          ? "bg-emerald-50/40 border-emerald-200"
                          : isFailed
                          ? "bg-rose-50/40 border-rose-200"
                          : "bg-slate-50 border-slate-200"
                      )}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {txn.gatewayTransactionId || txn.id.slice(0, 16)}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                              isSuccess
                                ? "bg-emerald-100 text-emerald-800"
                                : isFailed
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            )}
                          >
                            {txn.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {txn.gateway} · {txn.method} ·{" "}
                          {txn.initiatedAt.toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                        {txn.gatewayResponseMessage && (
                          <p className="text-[11px] text-slate-600 mt-1 italic">
                            {txn.gatewayResponseMessage}
                          </p>
                        )}
                      </div>

                      <div className="sm:text-right">
                        <p className="text-sm font-mono font-bold text-slate-900">
                          {formatINR(txn.amountPaise / 100)}
                        </p>
                        {isSuccess && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                            <ShieldCheck size={12} /> Settled
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <p className="font-bold text-slate-900">
                  {order.paymentMethod === "COD"
                    ? "Cash on Delivery (Pending Courier Handover)"
                    : "Direct Online Settlement"}
                </p>
                <p className="text-slate-600">
                  Payment Status: <strong>{order.paymentStatus}</strong> · Amount:{" "}
                  <strong>{formatINR(order.totalAmount)}</strong>
                </p>
                {order.razorpayPaymentId && (
                  <p className="font-mono text-slate-500 text-[11px]">
                    Payment Ref: {order.razorpayPaymentId}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Side Column ── */}
        <div className="space-y-6">
          {/* Shipping Address */}
          <div className="bg-surface border border-border-base rounded-xl p-5 shadow-xs text-xs">
            <h2 className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-700 mb-3">
              <MapPin size={15} className="text-brand-orange-600" /> Delivery Address
            </h2>
            <p className="font-bold text-slate-900 text-sm">{address.fullName || order.customerName || "Customer"}</p>
            <p className="text-slate-600 mt-1 leading-relaxed">
              {address.addressLine1}
              {address.addressLine2 && `, ${address.addressLine2}`}
              <br />
              {address.city}, {address.state} — {address.pincode}
              <br />
              <strong>Phone:</strong> {address.phone || order.customerPhone || "—"}
            </p>
          </div>

          {/* Seller Warehouse Information */}
          <div className="bg-surface border border-border-base rounded-xl p-5 shadow-xs text-xs space-y-1.5">
            <h2 className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-700 mb-2">
              <Building2 size={15} className="text-slate-600" /> Dispatched By
            </h2>
            <p className="font-bold text-slate-900">Vaishnavi Enterprises</p>
            <p className="text-slate-600 leading-relaxed">
              Main Market, Suriyawan Road, Bhadohi, Uttar Pradesh — 221404
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              GSTIN: 09AAEPV1234F1Z5
            </p>
          </div>

          {/* Live Customer Support Help Box */}
          <div className="bg-surface border border-dashed border-border-base rounded-xl p-6 text-center space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Need help with this order?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Our Bhadohi desk is available 10:00 AM – 7:30 PM (Mon–Sat) for delivery queries, return guidance, or invoice modifications.
            </p>
            <a
              href={ownerWhatsAppUrl(`Hi, I need assistance with Order ${orderNumberFormatted}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-whatsapp text-white text-xs font-bold uppercase tracking-wide hover:opacity-90 transition-opacity shadow-xs"
            >
              <MessageCircle size={16} />
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
