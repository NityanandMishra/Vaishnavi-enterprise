"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft, Loader2, CheckSquare } from "lucide-react";
import { formatINR } from "@/lib/utils";

export default function OrderPickListPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order not found");
      setOrder(data.order);
    } catch (err: any) {
      setError(err.message || "Failed to load pick list");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm font-semibold text-rose-600">{error || "Order not found"}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          Back
        </button>
      </div>
    );
  }

  // Cancelled items are EXCLUDED (ORD-13 AC 1)
  const activeItems = (order.items || []).filter(
    (item: any) => item.status !== "CANCELLED" && item.quantity - (item.cancelledQty || 0) > 0
  );

  const shipping = order.parsedShipping || {};
  const isCod = order.paymentMethod === "COD";

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:bg-white print:p-0">
      {/* Top web action toolbar — hidden in print */}
      <div className="mb-6 flex items-center justify-between print:hidden max-w-[800px] mx-auto">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          <span>Back to order</span>
        </button>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
        >
          <Printer size={15} />
          <span>Print Pick List</span>
        </button>
      </div>

      {/* A4 Sheet Container */}
      <div className="mx-auto max-w-[800px] bg-white p-8 sm:p-12 shadow-sm rounded-lg border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
              Pick List
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Placed: {new Date(order.placedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-xl font-bold text-slate-900 block">
              {order.orderNumber || `#${order.id.slice(0, 8)}`}
            </span>
            <span className="inline-block mt-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {order.status}
            </span>
          </div>
        </div>

        {/* Pick Items Table */}
        <div className="my-8">
          <div className="border-b border-slate-300 pb-2 flex text-xs font-bold uppercase text-slate-500">
            <span className="w-12 text-center">Tick</span>
            <span className="flex-1">SKU & Item Description</span>
            <span className="w-24 text-right">Quantity</span>
          </div>

          {activeItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 italic">
              All items in this order have been cancelled.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {activeItems.map((item: any) => {
                const qty = item.quantity - (item.cancelledQty || 0);
                return (
                  <div key={item.id} className="py-4 flex items-start">
                    {/* Tick Checkbox */}
                    <div className="w-12 flex justify-center pt-1">
                      <div className="h-6 w-6 border-2 border-slate-400 rounded-sm" />
                    </div>

                    {/* SKU & Description (SKU is largest text on the row - S6) */}
                    <div className="flex-1 px-2">
                      <div className="font-mono text-base sm:text-lg font-bold text-slate-900">
                        {item.sku || "NO-SKU"}
                      </div>
                      <div className="text-sm text-slate-700 font-medium mt-0.5">
                        {item.productName || item.displayName || "Product"}
                        {item.variantTitle && (
                          <span className="text-slate-500"> · {item.variantTitle}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        HSN: {item.hsnCode || "—"} · Location: Main Warehouse
                      </div>
                    </div>

                    {/* Quantity */}
                    <div className="w-24 text-right pt-1">
                      <span className="font-mono text-xl font-bold text-slate-900">
                        × {qty}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Shipping Info & COD Highlight */}
        <div className="mt-12 pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs">
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Ship to:
            </span>
            <p className="font-bold text-slate-900 text-sm">{shipping.fullName || order.customerName}</p>
            <p className="text-slate-700 mt-0.5">{shipping.addressLine1}</p>
            {shipping.addressLine2 && <p className="text-slate-700">{shipping.addressLine2}</p>}
            {shipping.landmark && <p className="text-slate-500">Landmark: {shipping.landmark}</p>}
            <p className="text-slate-900 font-semibold mt-0.5">
              {shipping.city}, {shipping.state} {shipping.pincode}
            </p>
            <p className="font-mono text-slate-700 mt-1">Phone: {shipping.phone || order.customerPhone}</p>
          </div>

          <div className="text-right flex flex-col justify-between">
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Fulfillment Details
              </span>
              <p className="text-slate-700">
                Total Units: <strong>{activeItems.reduce((s: number, i: any) => s + (i.quantity - (i.cancelledQty || 0)), 0)}</strong>
              </p>
              <p className="text-slate-700">Estimated Weight: 1.25 kg</p>
            </div>

            {/* COD Callout */}
            {isCod ? (
              <div className="mt-4 border-2 border-slate-900 bg-amber-50 p-3 rounded text-right">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block">
                  COLLECT ON DELIVERY (COD)
                </span>
                <span className="font-mono text-lg font-extrabold text-slate-900">
                  {formatINR(order.totalAmount)}
                </span>
              </div>
            ) : (
              <div className="mt-4 border border-slate-200 p-2 rounded text-right">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">
                  ✓ PREPAID ({order.paymentMethod})
                </span>
                <p className="text-[11px] text-slate-500">Do not collect payment from customer</p>
              </div>
            )}
          </div>
        </div>

        {/* Picker Signature */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between text-xs text-slate-500">
          <div>Picked by: _______________________</div>
          <div>Checked by: _______________________</div>
          <div>Date: __________________</div>
        </div>
      </div>
    </div>
  );
}
