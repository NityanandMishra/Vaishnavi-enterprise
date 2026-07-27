"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getOrderDetails, updateOrderStatus, updateOrderShipping } from "../actions";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Check,
  ShoppingBag,
  CreditCard,
  Truck,
  User,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  variantTitle?: string | null;
  product: {
    title: string;
    images: {
      image: {
        url: string;
      };
    }[];
  };
  variant: {
    title: string;
    sku: string | null;
  } | null;
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  shiprocketOrderId: string | null;
  shippingCost: number;
  deliveryZone: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingAddress: string; // JSON string
  createdAt: Date;
  user: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  items: OrderItem[];
}

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const orderId = params.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [status, setStatus] = useState("");
  const [shiprocketId, setShiprocketId] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    const res = await getOrderDetails(orderId);
    if (res.success && res.order) {
      const o = res.order as any;
      setOrder(o);
      setStatus(o.status);
      setShiprocketId(o.shiprocketOrderId || "");
      setTrackingNo(o.trackingNumber || "");
      setTrackingUrl(o.trackingUrl || "");
    } else {
      setError(res.error || "Failed to load order details");
    }
    setLoading(false);
  };

  const handleUpdateStatus = async () => {
    setSavingStatus(true);
    setError(null);
    setSuccessMsg(null);
    const res = await updateOrderStatus(orderId, status);
    if (res.success) {
      setSuccessMsg("Order status updated successfully!");
      fetchOrder();
    } else {
      setError(res.error || "Failed to update status");
    }
    setSavingStatus(false);
  };

  const handleUpdateShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShipping(true);
    setError(null);
    setSuccessMsg(null);
    const res = await updateOrderShipping(orderId, {
      shiprocketOrderId: shiprocketId || null,
      trackingNumber: trackingNo || null,
      trackingUrl: trackingUrl || null,
    });
    if (res.success) {
      setSuccessMsg("Shipping details updated successfully!");
      fetchOrder();
    } else {
      setError(res.error || "Failed to update logistics details");
    }
    setSavingShipping(false);
  };

  // Decode Shipping Address snapshot
  let parsedAddress: any = {};
  if (order?.shippingAddress) {
    try {
      parsedAddress = JSON.parse(order.shippingAddress);
    } catch (e) {
      parsedAddress = {};
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-2">
        <Loader2 size={32} className="animate-spin text-[#EA580C]" />
        <span>Loading order sheet...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="glass-card p-12 text-center text-slate-450 max-w-xl mx-auto">
        <AlertCircle size={40} className="mx-auto text-rose-500 mb-3" />
        <h3 className="font-sans font-bold text-[#0F172A] text-lg">Order Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">This order record does not exist or has been deleted.</p>
        <Link href="/admin/orders" className="text-[#EA580C] text-xs font-bold hover:underline mt-4 inline-block">
          Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="font-sans space-y-6 max-w-5xl mx-auto">
      {/* Header back link */}
      <div className="flex items-center gap-4 mb-4">
        <Link
          href="/admin/orders"
          className="p-2 rounded-[4px] bg-white border border-[#E2E8F0] text-[#475569] hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <span className="font-mono text-xs font-bold text-[#EA580C] bg-[#FFF7ED] border border-[#FFEDD5] px-2.5 py-0.5 rounded-[4px]">
            #{order.id}
          </span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-[6px] flex items-center gap-2">
          <AlertCircle size={18} />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-[6px] flex items-center gap-2">
          <Check size={18} />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Line Items List (Left/Top) ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items card */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
              <ShoppingBag size={18} className="text-[#EA580C]" />
              Order Items
            </h3>

            <div className="divide-y divide-[#E2E8F0]">
              {order.items.map((item) => {
                const mainImage = item.product.images.find((img) => img.image)?.image?.url || "";
                const variantTitle = item.variant?.title || item.variantTitle || "Standard";

                return (
                  <div key={item.id} className="py-3.5 flex items-start justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {mainImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mainImage} alt={item.product.title} className="object-contain w-full h-full p-1" />
                        ) : (
                          <ShoppingBag size={18} className="text-slate-350" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#0F172A] truncate max-w-xs md:max-w-sm">
                          {item.product.title}
                        </p>
                        <p className="text-[11px] text-[#64748B] font-medium mt-0.5">
                          Variant: {variantTitle}
                        </p>
                        {item.variant?.sku && (
                          <p className="text-[9px] text-[#94A3B8] font-mono mt-0.5">
                            SKU: {item.variant.sku}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-[#475569]">
                        {formatINR(item.price)} × {item.quantity}
                      </p>
                      <p className="text-xs font-bold text-[#EA580C] mt-1">
                        {formatINR(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Subtotal & Totals */}
            <div className="border-t border-[#E2E8F0] pt-4 space-y-2 text-xs font-bold text-[#475569]">
              <div className="flex justify-between">
                <span>Shipping Cost</span>
                <span className="text-[#0F172A]">{order.shippingCost === 0 ? "FREE" : formatINR(order.shippingCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Zone</span>
                <span className="text-[#0F172A]">{order.deliveryZone}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-[#E2E8F0]">
                <span className="text-[#0F172A]">Total Bill</span>
                <span className="text-[#EA580C]">{formatINR(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Logistics Form */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
              <Truck size={18} className="text-[#EA580C]" />
              Logistics & Courier Tracking (Shiprocket)
            </h3>

            <form onSubmit={handleUpdateShipping} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#475569] font-bold">Shiprocket Order ID</label>
                  <input
                    type="text"
                    value={shiprocketId}
                    onChange={(e) => setShiprocketId(e.target.value)}
                    placeholder="e.g. SR-384950-84"
                    className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-xs text-[#0f172a] focus:outline-none focus:border-[#EA580C] font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-[#475569] font-bold">Tracking AWN Number</label>
                  <input
                    type="text"
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                    placeholder="e.g. 7839485732"
                    className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-xs text-[#0f172a] focus:outline-none focus:border-[#EA580C] font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-[#475569] font-bold block">Courier Tracking URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="https://track.shiprocket.in/7839485732"
                    className="flex-1 bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-xs text-[#0f172a] focus:outline-none focus:border-[#EA580C] font-mono"
                  />
                  {trackingUrl && (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-[4px] bg-white border border-[#cbd5e1] hover:border-slate-400 text-slate-500 hover:text-[#0F172A] transition-colors"
                      title="Test tracking link"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingShipping}
                className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white py-2 px-4 rounded-[4px] font-semibold text-xs cursor-pointer transition-colors"
              >
                {savingShipping ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Update Logistics"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── Status, Customer & Delivery Info (Right/Bottom) ───────── */}
        <div className="lg:col-span-1 space-y-6">
          {/* Status Changer */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3">
              Order Status
            </h3>

            <div className="space-y-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
              >
                <option value="PENDING">PENDING</option>
                <option value="CAPTURED">CAPTURED (Paid)</option>
                <option value="COD_CONFIRMED">COD CONFIRMED (Ready to ship)</option>
                <option value="FULFILLED">FULFILLED (Shipped / Dispatched)</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED (Void order)</option>
                <option value="REFUNDED">REFUNDED</option>
              </select>

              <button
                onClick={handleUpdateStatus}
                disabled={savingStatus}
                className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold py-2.5 px-4 rounded-[4px] text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {savingStatus ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Updating Status...
                  </>
                ) : (
                  "Update Status"
                )}
              </button>
            </div>
          </div>

          {/* Customer Details */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
              <User size={18} className="text-[#EA580C]" />
              Customer Profile
            </h3>

            <div className="space-y-2.5 text-xs font-bold text-[#475569]">
              <div>
                <p className="text-[10px] text-slate-405 uppercase tracking-wide">Name</p>
                <p className="text-[#0F172A] mt-0.5 font-bold">{order.user.name || "N/A"}</p>
              </div>
              <div className="pt-1">
                <p className="text-[10px] text-slate-405 uppercase tracking-wide">Email</p>
                <p className="text-[#0F172A] font-mono mt-0.5 truncate">{order.user.email || "N/A"}</p>
              </div>
              <div className="pt-1">
                <p className="text-[10px] text-slate-405 uppercase tracking-wide">Phone Number</p>
                <p className="text-[#0F172A] font-mono mt-0.5">{order.user.phone || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
              <MapPin size={18} className="text-[#EA580C]" />
              Shipping Destination
            </h3>

            {parsedAddress?.fullName ? (
              <div className="space-y-2 text-xs text-[#475569] font-semibold leading-relaxed">
                <p className="font-bold text-[#0F172A] text-sm">{parsedAddress.fullName}</p>
                <p className="mt-1">
                  {parsedAddress.addressLine1}
                  {parsedAddress.addressLine2 && `, ${parsedAddress.addressLine2}`}
                </p>
                {parsedAddress.landmark && (
                  <p className="text-slate-500 italic">
                    Landmark: {parsedAddress.landmark}
                  </p>
                )}
                <p className="font-bold text-[#0F172A]">
                  {parsedAddress.city}, {parsedAddress.state} - {parsedAddress.pincode}
                </p>
                {parsedAddress.alternatePhone && (
                  <p className="text-slate-500">
                    Alt Phone: {parsedAddress.alternatePhone}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Address details parsing failed or snapshot missing.
              </p>
            )}
          </div>

          {/* Payment Card */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
              <CreditCard size={18} className="text-[#EA580C]" />
              Payment Records
            </h3>

            <div className="space-y-2.5 text-xs font-bold text-[#475569]">
              <div>
                <p className="text-[10px] text-slate-405 uppercase tracking-wide">Method</p>
                <p className="text-[#0F172A] mt-0.5">{order.paymentMethod}</p>
              </div>
              {order.razorpayOrderId && (
                <div className="pt-1">
                  <p className="text-[10px] text-slate-405 uppercase tracking-wide">Razorpay Order ID</p>
                  <p className="text-[#0F172A] font-mono mt-0.5 truncate">{order.razorpayOrderId}</p>
                </div>
              )}
              {order.razorpayPaymentId && (
                <div className="pt-1">
                  <p className="text-[10px] text-slate-405 uppercase tracking-wide">Razorpay Payment ID</p>
                  <p className="text-[#0F172A] font-mono mt-0.5 truncate">{order.razorpayPaymentId}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
