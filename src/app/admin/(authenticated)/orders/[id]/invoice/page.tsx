"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft, Loader2, Download, AlertCircle } from "lucide-react";
import { formatINR } from "@/lib/utils";

export default function OrderInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoice();
  }, [orderId]);

  const fetchInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/invoice`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404) {
          // Attempt generation
          await generateInvoice();
          return;
        }
        throw new Error(data.error || "Failed to fetch invoice");
      }
      setInvoiceData(data.data);
    } catch (err: any) {
      setError(err.message || "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  };

  const generateInvoice = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "Admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate invoice");
      if (data.invoice?.invoiceData) {
        setInvoiceData(JSON.parse(data.invoice.invoiceData));
      } else {
        await fetchInvoice();
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate invoice");
    } finally {
      setGenerating(false);
    }
  };

  if (loading || generating) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-slate-400" size={32} />
        <p className="text-xs text-slate-500 font-medium">Loading GST tax invoice...</p>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
          <AlertCircle size={32} className="text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-rose-900">Invoice Unavailable</h2>
          <p className="text-xs text-rose-700 mt-1">{error || "Could not load invoice data."}</p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={generateInvoice}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Generate Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { seller, buyer, items, isInterState } = invoiceData;

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:bg-white print:p-0">
      {/* Top Action Toolbar */}
      <div className="mb-6 flex items-center justify-between print:hidden max-w-[850px] mx-auto">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          <span>Back to order</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
          >
            <Printer size={15} />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>

      {/* Tax Invoice Document */}
      <div className="mx-auto max-w-[850px] bg-white p-8 sm:p-12 shadow-sm rounded-lg border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full text-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
              Tax Invoice
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Original for Recipient · (Issued under Rule 46 of CGST Rules, 2017)
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-lg font-bold text-slate-900 block">
              {invoiceData.invoiceNumber}
            </span>
            <p className="text-xs text-slate-600 mt-0.5">
              Date: {new Date(invoiceData.date).toLocaleDateString("en-IN")}
            </p>
            <p className="font-mono text-xs text-slate-500">Order: {invoiceData.orderNumber}</p>
          </div>
        </div>

        {/* Parties Grid (Seller & Buyer) */}
        <div className="grid grid-cols-2 gap-8 my-6 text-xs border-b border-slate-200 pb-6">
          {/* Seller Details */}
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Sold by:
            </span>
            <p className="font-bold text-sm text-slate-900">{seller.name}</p>
            {seller.tradeName && <p className="text-slate-600 font-medium">{seller.tradeName}</p>}
            <p className="text-slate-700 mt-0.5">{seller.address}</p>
            <p className="text-slate-700">
              {seller.city}, {seller.state} - {seller.pincode}
            </p>
            <p className="mt-1">
              <strong>GSTIN:</strong> <span className="font-mono font-semibold">{seller.gstin}</span>
            </p>
            <p>
              <strong>State Code:</strong> {seller.stateCode} ({seller.state})
            </p>
            <p className="text-slate-500 mt-0.5">Email: {seller.email}</p>
          </div>

          {/* Buyer Details */}
          <div className="text-right sm:text-left sm:pl-8">
            <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Billing & Delivery Address:
            </span>
            <p className="font-bold text-sm text-slate-900">{buyer.name}</p>
            <p className="text-slate-700 mt-0.5">{buyer.shippingAddress?.addressLine1}</p>
            {buyer.shippingAddress?.addressLine2 && (
              <p className="text-slate-700">{buyer.shippingAddress.addressLine2}</p>
            )}
            <p className="text-slate-700">
              {buyer.shippingAddress?.city}, {buyer.shippingAddress?.state} - {buyer.shippingAddress?.pincode}
            </p>
            <p className="mt-1">
              <strong>Place of Supply:</strong> {buyer.deliveryState} (Code: {buyer.deliveryStateCode})
            </p>
            <p className="font-mono text-slate-700">Phone: {buyer.phone}</p>
            {buyer.email && <p className="text-slate-500">Email: {buyer.email}</p>}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="my-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-50 text-[11px] font-bold text-slate-700 uppercase">
                <th className="py-2.5 px-2">#</th>
                <th className="py-2.5 px-2">Description & SKU</th>
                <th className="py-2.5 px-2">HSN</th>
                <th className="py-2.5 px-2 text-right">Qty</th>
                <th className="py-2.5 px-2 text-right">Unit Price</th>
                <th className="py-2.5 px-2 text-right">Taxable</th>
                <th className="py-2.5 px-2 text-right">GST %</th>
                {isInterState ? (
                  <th className="py-2.5 px-2 text-right">IGST</th>
                ) : (
                  <>
                    <th className="py-2.5 px-2 text-right">CGST</th>
                    <th className="py-2.5 px-2 text-right">SGST</th>
                  </>
                )}
                <th className="py-2.5 px-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item: any, idx: number) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-2 text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-2">
                    <div className="font-semibold text-slate-900">{item.productName}</div>
                    {item.variantTitle && (
                      <div className="text-[11px] text-slate-500">{item.variantTitle}</div>
                    )}
                    <div className="font-mono text-[10px] text-slate-400">{item.sku}</div>
                  </td>
                  <td className="py-3 px-2 font-mono">{item.hsnCode}</td>
                  <td className="py-3 px-2 text-right font-mono font-medium">{item.quantity}</td>
                  <td className="py-3 px-2 text-right font-mono">{formatINR(item.unitPrice)}</td>
                  <td className="py-3 px-2 text-right font-mono font-medium">{formatINR(item.taxableValue)}</td>
                  <td className="py-3 px-2 text-right font-mono">{item.gstRate}%</td>
                  {isInterState ? (
                    <td className="py-3 px-2 text-right font-mono">{formatINR(item.igstAmount)}</td>
                  ) : (
                    <>
                      <td className="py-3 px-2 text-right font-mono">{formatINR(item.cgstAmount)}</td>
                      <td className="py-3 px-2 text-right font-mono">{formatINR(item.sgstAmount)}</td>
                    </>
                  )}
                  <td className="py-3 px-2 text-right font-mono font-bold text-slate-900">
                    {formatINR(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Words Breakdown */}
        <div className="grid grid-cols-2 gap-8 my-6 pt-4 border-t-2 border-slate-900 text-xs">
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Amount in words:
            </span>
            <p className="font-medium text-slate-800 italic bg-slate-50 p-3 rounded border border-slate-200">
              {invoiceData.totalInWords}
            </p>

            <div className="mt-6 text-[11px] text-slate-500 space-y-1">
              <p>• Tax is payable on reverse charge basis: <strong>No</strong></p>
              <p>• Certified that the particulars given above are true and correct.</p>
            </div>
          </div>

          <div className="space-y-1.5 text-right font-mono text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 font-sans">Subtotal:</span>
              <span className="font-medium">{formatINR(invoiceData.subtotal)}</span>
            </div>

            {invoiceData.discount > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700">
                <span className="font-sans">Discount:</span>
                <span>− {formatINR(invoiceData.discount)}</span>
              </div>
            )}

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 font-sans">Taxable Value:</span>
              <span className="font-semibold">{formatINR(invoiceData.taxableValue)}</span>
            </div>

            {isInterState ? (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-sans">Integrated GST (IGST):</span>
                <span>{formatINR(invoiceData.igstTotal)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600 font-sans">Central GST (CGST):</span>
                  <span>{formatINR(invoiceData.cgstTotal)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600 font-sans">State GST (SGST):</span>
                  <span>{formatINR(invoiceData.sgstTotal)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 font-sans">Shipping & Handling:</span>
              <span>{formatINR(invoiceData.shipping)}</span>
            </div>

            <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold text-slate-900">
              <span className="font-sans">Grand Total:</span>
              <span>{formatINR(invoiceData.total)}</span>
            </div>
          </div>
        </div>

        {/* Authorized Signatory */}
        <div className="mt-16 pt-6 border-t border-slate-200 flex justify-between items-end text-xs">
          <div className="text-slate-400">
            This is a computer-generated tax invoice and is legally valid without physical signature.
          </div>
          <div className="text-right">
            <p className="font-bold text-slate-800">For Vaishnavi Enterprises</p>
            <div className="h-12" />
            <p className="text-slate-600 font-medium">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
