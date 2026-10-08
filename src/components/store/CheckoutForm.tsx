"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  Lock,
  AlertCircle,
  ImageOff,
  Smartphone,
  Banknote,
  CheckCircle2,
  FileText,
  Truck,
  ShieldCheck,
  Tag,
  X,
  Loader2,
} from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { placeOrder, validateCoupon, checkPincode } from "@/app/(store)/actions";

type SummaryLine = {
  id: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  price: number;
  imageUrl: string | null;
};

const INDIAN_STATES = [
  "Uttar Pradesh",
  "Maharashtra",
  "Delhi",
  "Bihar",
  "Madhya Pradesh",
  "Rajasthan",
  "Haryana",
  "Punjab",
  "Gujarat",
  "West Bengal",
  "Karnataka",
  "Tamil Nadu",
  "Telangana",
  "Andhra Pradesh",
  "Odisha",
  "Chhattisgarh",
  "Jharkhand",
  "Uttarakhand",
  "Himachal Pradesh",
  "Assam",
  "Kerala",
  "Goa",
  "Jammu & Kashmir",
] as const;

export default function CheckoutForm({
  lines,
  subtotal,
  gst: initialGst,
  total: initialTotal,
  defaultName,
}: {
  lines: SummaryLine[];
  subtotal: number;
  gst: number;
  total: number;
  defaultName: string;
}) {
  const [payment, setPayment] = useState<"RAZORPAY" | "COD">("RAZORPAY");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // GST Invoice State (§6.6)
  const [needsGstInvoice, setNeedsGstInvoice] = useState(false);
  const [gstin, setGstin] = useState("");
  const [firmName, setFirmName] = useState("");

  // Pincode & Delivery Serviceability (§6.6)
  const [pincode, setPincode] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState<{
    loading: boolean;
    result: {
      ok: boolean;
      etaDate?: string;
      couriers?: string[];
      zone?: string;
      error?: string;
    } | null;
  }>({ loading: false, result: null });

  // Coupon State
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    message: string;
  } | null>(null);

  async function handlePincodeBlur(e: React.FocusEvent<HTMLInputElement>) {
    const code = e.target.value.trim();
    if (!/^\d{6}$/.test(code)) {
      if (code) {
        setPincodeStatus({
          loading: false,
          result: { ok: false, error: "Enter a valid 6-digit Indian PIN code." },
        });
      } else {
        setPincodeStatus({ loading: false, result: null });
      }
      return;
    }

    setPincodeStatus({ loading: true, result: null });
    try {
      const res = await checkPincode(code);
      setPincodeStatus({
        loading: false,
        result: res.ok
          ? {
              ok: true,
              etaDate: res.etaDate,
              couriers: res.couriers,
              zone: res.zone,
            }
          : { ok: false, error: res.error },
      });
    } catch {
      setPincodeStatus({
        loading: false,
        result: { ok: false, error: "Could not verify PIN code serviceability." },
      });
    }
  }

  async function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponError(null);
    setCouponLoading(true);

    try {
      const res = await validateCoupon(couponCode, subtotal);
      if (res.ok) {
        setAppliedCoupon({
          code: res.code,
          discount: res.discount,
          message: res.message,
        });
        setCouponCode("");
      } else {
        setCouponError(res.error);
      }
    } catch {
      setCouponError("Failed to validate coupon code.");
    } finally {
      setCouponLoading(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
  }

  // Dynamic calculations
  const discountAmount = appliedCoupon ? appliedCoupon.discount : 0;
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);
  const dynamicGst = Math.round(taxableSubtotal * 0.18);
  const dynamicTotal = taxableSubtotal + dynamicGst;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("paymentMethod", payment);

    if (appliedCoupon) {
      formData.set("couponCode", appliedCoupon.code);
    }

    if (needsGstInvoice) {
      if (!gstin.trim() || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.trim().toUpperCase())) {
        setError("Please enter a valid 15-character GSTIN (e.g. 09ABCDE1234F1Z5).");
        return;
      }
      formData.set("gstin", gstin.trim().toUpperCase());
      formData.set("firmName", firmName.trim());
    }

    startTransition(async () => {
      const response = await placeOrder(null, formData);
      if (response && !response.ok) {
        setError(response.error);
      }
    });
  }

  const summary = (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-5">
      <div className="border-b border-[var(--line-soft)] pb-3">
        <h2 className="text-base font-bold text-[var(--fg)] tracking-tight">
          Dispatch Summary ({lines.length} items)
        </h2>
      </div>

      <ul className="divide-y divide-[var(--line-soft)] max-h-80 overflow-y-auto pr-1">
        {lines.map((line) => (
          <li key={line.id} className="py-3 flex gap-3 first:pt-0 last:pb-0">
            <div className="relative w-14 h-14 flex-shrink-0 bg-[var(--mortar)] rounded border border-[var(--line-soft)] overflow-hidden">
              {line.imageUrl ? (
                <Image
                  src={line.imageUrl}
                  alt={line.title}
                  fill
                  className="object-contain p-1"
                  sizes="56px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageOff size={16} className="text-[var(--fg-quiet)]" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--fg)] leading-snug line-clamp-2">
                {line.title}
              </p>
              <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                Qty: <span className="font-bold fig">{line.quantity}</span>
                {line.variantTitle && ` · ${line.variantTitle}`}
              </p>
            </div>
            <p className="text-sm font-bold text-[var(--fg)] whitespace-nowrap fig">
              ₹{formatINR(line.price * line.quantity)}
            </p>
          </li>
        ))}
      </ul>

      {/* Coupon Code Section */}
      <div className="pt-3 border-t border-[var(--line-soft)]">
        {appliedCoupon ? (
          <div className="p-3 bg-[var(--ok-wash)] border border-[var(--ok)]/30 rounded flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[var(--ok)] font-medium">
              <Tag size={15} />
              <div>
                <span className="font-bold uppercase font-mono">{appliedCoupon.code}</span>
                <span className="text-[11px] block">{appliedCoupon.message}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              aria-label="Remove coupon"
              className="w-6 h-6 rounded flex items-center justify-center text-[var(--ok)] hover:bg-[var(--ok-wash)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleApplyCoupon} className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-quiet)]" />
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setCouponError(null);
                  }}
                  placeholder="Coupon code"
                  className="w-full h-10 pl-9 pr-3 uppercase font-mono text-xs border border-[var(--line)] rounded bg-[var(--surface)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <button
                type="submit"
                disabled={couponLoading || !couponCode.trim()}
                className="act act-ink h-10 px-4 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {couponLoading && <Loader2 size={13} className="animate-spin mr-1" />}
                Apply
              </button>
            </div>
            {couponError && (
              <p className="text-xs text-[var(--signal-700)] font-medium flex items-center gap-1">
                <AlertCircle size={13} /> {couponError}
              </p>
            )}
          </form>
        )}
      </div>

      <dl className="space-y-2.5 text-sm pt-4 border-t border-[var(--line-soft)]">
        <div className="flex justify-between">
          <dt className="text-[var(--fg-muted)]">Subtotal</dt>
          <dd className="font-semibold text-[var(--fg)] fig">₹{formatINR(subtotal)}</dd>
        </div>

        {appliedCoupon && (
          <div className="flex justify-between text-[var(--ok)] font-medium">
            <dt>Coupon Discount ({appliedCoupon.code})</dt>
            <dd className="font-bold fig">-₹{formatINR(discountAmount)}</dd>
          </div>
        )}

        <div className="flex justify-between">
          <dt className="text-[var(--fg-muted)] flex items-center gap-1.5">
            <span>Logistics Dispatch</span>
            <span className="flag flag-ok text-[11px] py-0.5">Free</span>
          </dt>
          <dd className="font-bold text-[var(--ok)]">FREE</dd>
        </div>

        <div className="flex justify-between">
          <dt className="text-[var(--fg-muted)]">GST (18% included)</dt>
          <dd className="font-semibold text-[var(--fg)] fig">₹{formatINR(dynamicGst)}</dd>
        </div>

        <div className="flex justify-between pt-3 border-t border-[var(--line-soft)] items-baseline">
          <dt className="text-base font-bold text-[var(--fg)]">Total Payable</dt>
          <dd className="text-2xl font-black text-[var(--fg)] fig tracking-tight">
            ₹{formatINR(dynamicTotal)}
          </dd>
        </div>
      </dl>

      <div className="pt-3 border-t border-[var(--line-soft)] space-y-2 text-xs text-[var(--fg-muted)]">
        <div className="flex items-center gap-2">
          <Truck size={14} className="text-[var(--ok)] flex-shrink-0" />
          <span>Carefully packed with transit seals & heavy-duty crates.</span>
        </div>
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-[var(--accent)] flex-shrink-0" />
          <span>GST tax invoice included in shipment box.</span>
        </div>
      </div>
    </div>
  );

  const placeOrderButton = (
    <button
      type="submit"
      form="checkout-form"
      disabled={isPending}
      className="act act-fill act-big act-wide text-base font-bold uppercase tracking-wider shadow-sm disabled:opacity-50"
    >
      <Lock size={18} />
      {isPending ? "Confirming Order…" : "Place Order"}
    </button>
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-10 lg:items-start">
      <form id="checkout-form" onSubmit={handleSubmit} className="space-y-8">
        {/* ── Section 1: Shipping Address ──────────────────────────────────── */}
        <section className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--line-soft)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-[var(--ink-900)] text-white text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h2 className="text-lg font-bold text-[var(--fg)] tracking-tight">
                Consignee & Delivery Address
              </h2>
            </div>
            <span className="text-xs text-[var(--fg-muted)]">* Required fields</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="fullName"
              label="Full Name / Receiver Name"
              defaultValue={defaultName}
              placeholder="e.g. Ramesh Chandra Mishra"
              required
            />
            <Field
              name="phone"
              label="Mobile Number (10 digits)"
              type="tel"
              placeholder="e.g. 9876543210"
              required
            />
            <Field
              name="addressLine1"
              label="Street Address / Building / Flat"
              placeholder="e.g. Shop 4, Station Road, Opp. Market"
              className="sm:col-span-2"
              required
            />
            <Field
              name="addressLine2"
              label="Area / Landmark / Colony (Optional)"
              placeholder="e.g. Near Power Substation, Civil Lines"
              className="sm:col-span-2"
            />
            <div>
              <Field
                name="pincode"
                label="Delivery PIN Code"
                placeholder="6-digit PIN"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                onBlur={handlePincodeBlur}
                className="fig"
                required
              />
              {pincodeStatus.loading && (
                <p className="text-xs text-[var(--fg-muted)] mt-1.5 flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin text-[var(--accent)]" />
                  Checking courier transit routes…
                </p>
              )}
              {pincodeStatus.result && (
                <div
                  className={cn(
                    "mt-2 p-2.5 rounded text-xs border flex items-start gap-2",
                    pincodeStatus.result.ok
                      ? "bg-[var(--ok-wash)] border-[var(--ok)]/30 text-[var(--ok)]"
                      : "bg-red-50 border-red-200 text-[var(--signal-700)]"
                  )}
                >
                  {pincodeStatus.result.ok ? (
                    <>
                      <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">
                          Direct service active to {pincodeStatus.result.zone}
                        </p>
                        <p className="text-[11px] mt-0.5 opacity-90">
                          Estimated delivery by <strong>{pincodeStatus.result.etaDate}</strong> via{" "}
                          {pincodeStatus.result.couriers?.join(", ") || "Express Cargo"}.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                      <span>{pincodeStatus.result.error}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <Field
              name="city"
              label="City / Town"
              placeholder="e.g. Bhadohi / Varanasi"
              required
            />

            <div className="sm:col-span-2">
              <label
                htmlFor="checkout-state"
                className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5"
              >
                State
              </label>
              <select
                id="checkout-state"
                name="state"
                defaultValue="Uttar Pradesh"
                required
                className="w-full min-h-[48px] px-3 bg-[var(--surface)] border border-[var(--line)] rounded text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ── Section 2: GST Invoice Option (§6.6) ─────────────────────────── */}
        <section className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-6 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={needsGstInvoice}
              onChange={(e) => setNeedsGstInvoice(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <div>
              <span className="text-sm font-bold text-[var(--fg)] block">
                I need a commercial GST Tax Invoice in my firm's name
              </span>
              <span className="text-xs text-[var(--fg-muted)] block mt-0.5">
                Enable input tax credit (ITC) on this business purchase.
              </span>
            </div>
          </label>

          {needsGstInvoice && (
            <div className="pt-4 border-t border-[var(--line-soft)] grid gap-4 sm:grid-cols-2">
              <Field
                name="firmName"
                label="Registered Business / Firm Name"
                placeholder="e.g. Mishra Electricals & Contractors"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                required={needsGstInvoice}
              />
              <Field
                name="gstin"
                label="15-Digit GSTIN"
                placeholder="e.g. 09AAACV1234E1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                className="font-mono uppercase"
                required={needsGstInvoice}
              />
              <p className="text-xs text-[var(--fg-muted)] sm:col-span-2">
                Your GSTIN will be verified and printed on the official invoice for GST credit filing.
              </p>
            </div>
          )}
        </section>

        {/* ── Section 3: Payment Method (§6.6 Equal-Legitimacy Cards) ──────── */}
        <section className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[var(--line-soft)] pb-3">
            <span className="w-6 h-6 rounded-full bg-[var(--ink-900)] text-white text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h2 className="text-lg font-bold text-[var(--fg)] tracking-tight">
              Payment Choice
            </h2>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            {/* Pay Now Option */}
            <label
              className={cn(
                "p-4 rounded-lg border-2 cursor-pointer flex flex-col justify-between gap-3 transition-colors",
                payment === "RAZORPAY"
                  ? "border-[var(--accent)] bg-[var(--accent-wash)]"
                  : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--fg-quiet)]"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="paymentChoice"
                    value="RAZORPAY"
                    checked={payment === "RAZORPAY"}
                    onChange={() => setPayment("RAZORPAY")}
                    className="w-4 h-4 text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <span className="text-sm font-bold text-[var(--fg)]">
                    Pay Now
                  </span>
                </div>
                <Smartphone size={20} className="text-[var(--accent)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
                  UPI (PhonePe, GPay, Paytm), Credit/Debit Cards, or Net Banking. Instant digital receipt.
                </p>
              </div>
            </label>

            {/* Cash on Delivery Option (Equal Legitimacy) */}
            <label
              className={cn(
                "p-4 rounded-lg border-2 cursor-pointer flex flex-col justify-between gap-3 transition-colors",
                payment === "COD"
                  ? "border-[var(--ok)] bg-[var(--ok-wash)]"
                  : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--fg-quiet)]"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="paymentChoice"
                    value="COD"
                    checked={payment === "COD"}
                    onChange={() => setPayment("COD")}
                    className="w-4 h-4 text-[var(--ok)] focus:ring-[var(--ok)]"
                  />
                  <span className="text-sm font-bold text-[var(--fg)]">
                    Cash on Delivery (COD)
                  </span>
                </div>
                <Banknote size={20} className="text-[var(--ok)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
                  Pay cash or scan UPI QR with courier partner at the doorstep upon arrival. Zero advance.
                </p>
              </div>
            </label>
          </div>
        </section>

        {error && (
          <div
            className="p-4 rounded-lg bg-red-50 border border-red-200 text-[var(--signal-700)] text-sm flex items-center gap-2.5"
            role="alert"
          >
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Mobile Summary & Trigger */}
        <div className="lg:hidden">{summary}</div>
      </form>

      {/* ── Desktop Sticky Summary Column (§6.6) ────────────────────────── */}
      <aside className="hidden lg:block lg:sticky lg:top-24 space-y-4">
        {summary}
        {placeOrderButton}
      </aside>

      {/* ── Mobile Sticky Bar ────────────────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface)] border-t border-[var(--line)] shadow-lg px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            Total to Pay
          </span>
          <span className="text-xl font-black text-[var(--fg)] fig">
            ₹{formatINR(dynamicTotal)}
          </span>
        </div>
        {placeOrderButton}
      </div>

      <div className="h-28 lg:hidden" aria-hidden />
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
  value,
  onChange,
  onBlur,
  className,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={`checkout-${name}`}
        className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5"
      >
        {label} {required && <span className="text-[var(--signal-700)]">*</span>}
      </label>
      <input
        id={`checkout-${name}`}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className="w-full min-h-[48px] px-3 bg-[var(--surface)] border border-[var(--line)] rounded text-base text-[var(--fg)] placeholder-[var(--fg-quiet)] focus:outline-none focus:border-[var(--accent)]"
      />
    </div>
  );
}
