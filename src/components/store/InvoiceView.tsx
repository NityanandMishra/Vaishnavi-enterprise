"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Printer, ArrowLeft, Download, ShieldCheck } from "lucide-react";
import { formatINR } from "@/lib/utils";

export interface InvoiceItem {
  id: string;
  title: string;
  variantTitle?: string | null;
  hsnCode?: string | null;
  quantity: number;
  price: number; // inclusive of GST
}

export interface InvoiceData {
  invoiceNumber: string;
  orderId: string;
  orderDate: Date | string;
  paymentMethod: string;
  paymentStatus: string;
  transactionId?: string | null;

  // Seller Details
  seller: {
    name: string;
    tradeName: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    gstin: string;
    phone: string;
    email: string;
  };

  // Buyer Details
  buyer: {
    name: string;
    phone?: string;
    email?: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    pincode: string;
  };

  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  couponCode?: string | null;
  shippingCost: number;
  gstAmount: number;
  totalAmount: number;
}

export default function InvoiceView({
  invoice,
  backHref = "/account",
}: {
  invoice: InvoiceData;
  backHref?: string;
}) {
  function handlePrint() {
    window.print();
  }

  // Calculate tax breakdown (assuming standard 18% GST: 9% CGST + 9% SGST for intra-state UP)
  const isIntraState =
    invoice.buyer.state.toLowerCase().includes("uttar pradesh") ||
    invoice.buyer.state.toLowerCase() === "up";

  const taxableValue = invoice.subtotal - invoice.discountAmount;
  const cgst = isIntraState ? invoice.gstAmount / 2 : 0;
  const sgst = isIntraState ? invoice.gstAmount / 2 : 0;
  const igst = !isIntraState ? invoice.gstAmount : 0;

  const formattedDate = new Date(invoice.orderDate).toLocaleDateString("en-IN", {
    dateStyle: "long",
  });

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white text-slate-900">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Printer size={16} />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Invoice Paper Sheet */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 shadow-md rounded-lg p-8 sm:p-12 print:border-none print:shadow-none print:p-0 print:m-0 font-sans">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl font-black tracking-tight text-slate-900">
                VAISHNAVI ENTERPRISES
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
              {invoice.seller.address}, {invoice.seller.city}, {invoice.seller.state} —{" "}
              {invoice.seller.pincode}
              <br />
              <strong>GSTIN:</strong> {invoice.seller.gstin} | <strong>Phone:</strong>{" "}
              {invoice.seller.phone}
              <br />
              <strong>Email:</strong> {invoice.seller.email}
            </p>
          </div>

          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded">
              Tax Invoice
            </span>
            <p className="text-sm font-mono font-bold text-slate-900 mt-2">
              {invoice.invoiceNumber}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              <strong>Invoice Date:</strong> {formattedDate}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              <strong>Order ID:</strong> #{invoice.orderId.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        {/* Bill To & Ship To Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 text-xs">
          <div>
            <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-1">
              Billed & Shipped To:
            </p>
            <p className="font-bold text-slate-900 text-sm">{invoice.buyer.name}</p>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              {invoice.buyer.addressLine1}
              {invoice.buyer.addressLine2 && `, ${invoice.buyer.addressLine2}`}
              <br />
              {invoice.buyer.city}, {invoice.buyer.state} — {invoice.buyer.pincode}
            </p>
            {invoice.buyer.phone && (
              <p className="text-slate-600 mt-1">
                <strong>Phone:</strong> {invoice.buyer.phone}
              </p>
            )}
          </div>

          <div className="sm:text-right flex flex-col justify-between">
            <div>
              <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-1">
                Payment Information:
              </p>
              <p className="text-slate-700">
                <strong>Payment Method:</strong> {invoice.paymentMethod}
              </p>
              <p className="text-slate-700 mt-0.5">
                <strong>Payment Status:</strong>{" "}
                <span className="font-bold text-emerald-700">{invoice.paymentStatus}</span>
              </p>
              {invoice.transactionId && (
                <p className="text-slate-700 mt-0.5 font-mono text-[11px]">
                  <strong>Txn ID:</strong> {invoice.transactionId}
                </p>
              )}
            </div>

            <div className="mt-3">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                <ShieldCheck size={13} /> Genuine GST Tax Invoice
              </span>
            </div>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-y-2 border-slate-900 bg-slate-100 font-bold uppercase tracking-wider text-slate-700">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Item Description</th>
                <th className="py-2.5 px-3 text-center">HSN</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Total (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.items.map((item, idx) => (
                <tr key={item.id}>
                  <td className="py-3 px-3 font-mono text-slate-500">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    {item.variantTitle && (
                      <p className="text-slate-500 text-[11px]">Variant: {item.variantTitle}</p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-600">
                    {item.hsnCode || "8541"}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-medium">{item.quantity}</td>
                  <td className="py-3 px-3 text-right font-mono">{formatINR(item.price)}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    {formatINR(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculations & Tax Breakdown */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 border-t border-slate-200 pt-4">
          <div className="max-w-xs text-xs text-slate-600 space-y-2">
            <p className="font-bold text-slate-900">Terms & Conditions:</p>
            <ul className="list-disc pl-4 space-y-1 text-[11px]">
              <li>Goods once sold carry manufacturer warranty as applicable.</li>
              <li>For service or warranty queries, contact Suriyawan head office.</li>
              <li>Subject to Bhadohi jurisdiction.</li>
            </ul>
          </div>

          <div className="w-full sm:w-72 space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Taxable Value</span>
              <span className="font-mono font-medium">{formatINR(taxableValue)}</span>
            </div>

            {invoice.discountAmount > 0 && (
              <div className="flex justify-between py-1 text-emerald-700 border-b border-slate-100 font-medium">
                <span>Coupon Discount ({invoice.couponCode || "PROMO"})</span>
                <span className="font-mono">-{formatINR(invoice.discountAmount)}</span>
              </div>
            )}

            {isIntraState ? (
              <>
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>CGST (9%)</span>
                  <span className="font-mono">{formatINR(cgst)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>SGST (9%)</span>
                  <span className="font-mono">{formatINR(sgst)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                <span>IGST (18%)</span>
                <span className="font-mono">{formatINR(igst)}</span>
              </div>
            )}

            <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
              <span>Shipping & Delivery</span>
              <span className="font-mono">
                {invoice.shippingCost === 0 ? "FREE" : formatINR(invoice.shippingCost)}
              </span>
            </div>

            <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold text-slate-900">
              <span>Grand Total</span>
              <span className="font-mono text-base">{formatINR(invoice.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Signature & Stamp Section */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex items-end justify-between flex-wrap gap-4">
          <div className="text-[11px] text-slate-500">
            <p>This is a computer generated invoice and does not require physical stamp.</p>
          </div>

          <div className="text-right">
            <p className="text-xs font-bold text-slate-900">For Vaishnavi Enterprises</p>
            <div className="h-12 flex items-center justify-end">
              <span className="font-mono text-xs text-slate-400 italic font-semibold">
                Authorized Signatory
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
