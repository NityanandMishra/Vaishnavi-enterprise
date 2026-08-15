"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Lock, AlertCircle, ImageOff, Smartphone, CreditCard, Landmark, Banknote } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { placeOrder } from "@/app/(store)/actions";

type SummaryLine = {
  id: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  price: number;
  imageUrl: string | null;
};

const PAYMENT_METHODS = [
  { value: "RAZORPAY", label: "UPI (GPay, PhonePe)", icon: Smartphone },
  { value: "RAZORPAY_CARD", label: "Debit / Credit Card", icon: CreditCard },
  { value: "RAZORPAY_NB", label: "Netbanking", icon: Landmark },
  { value: "COD", label: "Cash on Delivery (COD)", icon: Banknote },
] as const;

const SHIPPING_METHODS = [
  { value: "standard", label: "Standard Ground", detail: "Delivery in 3–5 business days", price: "Free" },
  { value: "express", label: "Express Heavy", detail: "Priority 2-day delivery", price: "₹2,450" },
] as const;

export default function CheckoutForm({
  lines,
  subtotal,
  gst,
  total,
  defaultName,
}: {
  lines: SummaryLine[];
  subtotal: number;
  gst: number;
  total: number;
  defaultName: string;
}) {
  const [payment, setPayment] = useState<string>("RAZORPAY");
  const [shipping, setShipping] = useState<string>("standard");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    // Card and netbanking both settle through Razorpay.
    formData.set("paymentMethod", payment === "COD" ? "COD" : "RAZORPAY");

    startTransition(async () => {
      const response = await placeOrder(null, formData);
      if (response && !response.ok) setError(response.error);
    });
  }

  const summary = (
    <div className="bg-surface border border-border-base rounded-lg p-5">
      <h2 className="text-base font-semibold text-slate-900 mb-4">Items ({lines.length})</h2>
      <ul className="space-y-3 mb-5">
        {lines.map((line) => (
          <li key={line.id} className="flex gap-3">
            <div className="relative w-14 h-14 flex-shrink-0 bg-surface-alt rounded-md overflow-hidden">
              {line.imageUrl ? (
                <Image src={line.imageUrl} alt="" fill className="object-contain p-1" sizes="56px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageOff size={16} className="text-slate-300" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 leading-snug line-clamp-2">
                {line.title}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Qty: {line.quantity}
                {line.variantTitle && ` · ${line.variantTitle}`}
              </p>
            </div>
            <p className="text-sm font-bold text-slate-900 whitespace-nowrap">
              {formatINR(line.price * line.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="space-y-2 text-sm pt-4 border-t border-border-base">
        <div className="flex justify-between">
          <dt className="text-slate-600">Subtotal</dt>
          <dd className="text-slate-900">{formatINR(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">GST (18%)</dt>
          <dd className="text-slate-900">{formatINR(gst)}</dd>
        </div>
        <div className="flex justify-between pt-2 border-t border-border-base">
          <dt className="text-base font-bold text-slate-900">Total Amount</dt>
          <dd className="text-base font-bold text-slate-900">{formatINR(total)}</dd>
        </div>
      </dl>
    </div>
  );

  const placeOrderButton = (
    <button
      type="submit"
      form="checkout-form"
      disabled={isPending}
      className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-md bg-brand-orange-600 text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity"
    >
      <Lock size={17} />
      {isPending ? "Placing order…" : "Place Order"}
    </button>
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:items-start">
      <form id="checkout-form" onSubmit={handleSubmit} className="space-y-8">
        <div className="flex items-start gap-3 bg-surface-sunken border border-border-base rounded-lg p-4">
          <Lock size={18} className="text-slate-900 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Secure Checkout</p>
            <p className="text-xs text-slate-600">Your transaction is encrypted and safe.</p>
          </div>
        </div>

        {/* Shipping address */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Shipping Address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="fullName" label="Full Name" defaultValue={defaultName} required />
            <Field name="phone" label="Mobile Number" type="tel" placeholder="10-digit mobile" required />
            <Field name="addressLine1" label="Address Line 1" className="sm:col-span-2" required />
            <Field name="addressLine2" label="Address Line 2 (optional)" className="sm:col-span-2" />
            <Field name="city" label="City" required />
            <Field name="state" label="State" required />
            <Field name="pincode" label="Pincode" placeholder="6-digit pincode" required />
          </div>
        </section>

        {/* Shipping method */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Shipping Method</h2>
          <div className="space-y-3">
            {SHIPPING_METHODS.map((m) => (
              <label
                key={m.value}
                className={cn(
                  "flex items-center gap-3 min-h-[64px] px-4 rounded-md border cursor-pointer transition-colors",
                  shipping === m.value
                    ? "border-slate-900 border-2 bg-surface"
                    : "border-border-base bg-surface hover:border-slate-300"
                )}
              >
                <input
                  type="radio"
                  name="shippingMethod"
                  value={m.value}
                  checked={shipping === m.value}
                  onChange={() => setShipping(m.value)}
                  className="w-4 h-4 accent-slate-900"
                />
                <span className="flex-1">
                  <span className="block text-sm font-bold text-slate-900">{m.label}</span>
                  <span className="block text-xs text-slate-600">{m.detail}</span>
                </span>
                <span className="text-sm font-bold text-slate-900">{m.price}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Payment method */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment Method</h2>
          <div className="space-y-3">
            {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
              <label
                key={value}
                className={cn(
                  "flex items-center gap-3 min-h-[56px] px-4 rounded-md border cursor-pointer transition-colors",
                  payment === value
                    ? "border-slate-900 border-2 bg-surface"
                    : "border-border-base bg-surface hover:border-slate-300"
                )}
              >
                <input
                  type="radio"
                  name="paymentChoice"
                  value={value}
                  checked={payment === value}
                  onChange={() => setPayment(value)}
                  className="w-4 h-4 accent-brand-orange-600"
                />
                <Icon size={20} className="text-slate-900" />
                <span className="text-sm font-bold text-slate-900">{label}</span>
              </label>
            ))}
          </div>
        </section>

        {error && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-danger" role="alert">
            <AlertCircle size={16} />
            {error}
          </p>
        )}

        {/* Desktop place-order lives in the summary column */}
        <div className="lg:hidden">{summary}</div>
      </form>

      <div className="hidden lg:block lg:sticky lg:top-24 space-y-4">
        {summary}
        {placeOrderButton}
      </div>

      {/* Mobile sticky order bar */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 bg-surface border-t border-border-base shadow-lg px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-900">Total Amount</span>
          <span className="text-base font-bold text-slate-900">{formatINR(total)}</span>
        </div>
        {placeOrderButton}
      </div>

      <div className="h-36 lg:hidden" aria-hidden />
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  required,
  defaultValue,
  className,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={`checkout-${name}`}
        className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5"
      >
        {label}
      </label>
      <input
        id={`checkout-${name}`}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        className="w-full min-h-[44px] px-3 bg-surface border border-border-base rounded-md text-sm text-slate-900 placeholder-muted focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
    </div>
  );
}
