"use client";

import { useState, useTransition } from "react";
import { MessageCircle, PhoneCall, Check, AlertCircle, Clock, ShieldCheck, Send } from "lucide-react";
import { cn, ownerWhatsAppUrl } from "@/lib/utils";
import { submitLead } from "@/app/(store)/actions";

interface ProductInquiryBoxProps {
  productId: string;
  productTitle: string;
  sku?: string;
  sourcingLeadDays?: number | null;
}

/**
 * Product Inquiry Box (§6.4 Product Detail, INQUIRE)
 *
 * Replaces the price block on INQUIRE products:
 * 1. "Price on request" set at prominent price weight in --ask
 * 2. Plain-language reasoning line
 * 3. 3-step numbered explainer
 * 4. Full-width WhatsApp CTA with prefilled message
 * 5. Response time guarantee
 * 6. Maximum 4-field callback form (Name, Mobile, Quantity, Pincode)
 * 7. ZERO cart controls, ZERO prices.
 */
export default function ProductInquiryBox({
  productId,
  productTitle,
  sku = "",
  sourcingLeadDays = 7,
}: ProductInquiryBoxProps) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [pincode, setPincode] = useState("");

  const whatsappMessage = `Hello Vaishnavi Enterprises, I want to inquire about today's price and availability for: ${productTitle} (SKU: ${sku || "standard"}).`;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !/^\d{10}$/.test(phone.trim())) {
      setResult({ ok: false, message: "Please provide your full name and a valid 10-digit mobile number." });
      return;
    }

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("phone", phone.trim());
    formData.set("city", "Pincode " + (pincode || "221404"));
    formData.set("pincode", pincode.trim() || "221404");
    formData.set("productId", productId);
    formData.set("productName", productTitle);
    formData.set(
      "message",
      `Inquiry for ${quantity} unit(s). Pincode: ${pincode || "Suriyawan"}. Sku: ${sku}`
    );

    startTransition(async () => {
      const response = await submitLead(null, formData);
      if (response.ok) {
        setResult({
          ok: true,
          message: "Thank you! Our Suriyawan sales desk will call you with today's factory quote within 1 hour.",
        });
        setName("");
        setPhone("");
        setPincode("");
      } else {
        setResult({ ok: false, message: response.error || "Unable to submit request. Please WhatsApp us directly." });
      }
    });
  }

  return (
    <div className="bg-[var(--ask-bg)] border border-[var(--ask-line)] rounded-lg p-6 space-y-6">
      {/* ── 1. "Price on Request" Block (§6.4 Item 1 & 2) ─────────────── */}
      <div className="border-b border-[var(--brass-line)] pb-5">
        <span className="flag flag-ask mb-2">ORDER TO SIZE</span>
        <div className="text-3xl font-extrabold text-[var(--ask)] tracking-tight mt-1">
          Price on request
        </div>
        <p className="text-sm text-[var(--fg-muted)] mt-1.5 leading-relaxed">
          Brought in on order directly from manufacturer. Rates track raw metal & lithium indexes and are confirmed with the factory daily.
        </p>
      </div>

      {/* ── 2. Three Numbered Steps (§6.4 Item 3) ─────────────────────── */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ask)]">
          How Sourcing Works
        </h4>

        <div className="grid grid-cols-1 gap-2.5 text-xs text-[var(--fg-muted)]">
          <div className="flex items-start gap-3 p-3 rounded bg-white border border-[var(--brass-line)]">
            <span className="w-5 h-5 rounded-full bg-[var(--ask)] text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
              1
            </span>
            <div>
              <b className="text-[var(--fg)] block">You tell us your requirement</b>
              <span>Let us know your quantity, delivery location, or custom parameters.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded bg-white border border-[var(--brass-line)]">
            <span className="w-5 h-5 rounded-full bg-[var(--ask)] text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
              2
            </span>
            <div>
              <b className="text-[var(--fg)] block">We reply the same day</b>
              <span>We check current factory availability and quote today’s exact tax-inclusive rate.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded bg-white border border-[var(--brass-line)]">
            <span className="w-5 h-5 rounded-full bg-[var(--ask)] text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
              3
            </span>
            <div>
              <b className="text-[var(--fg)] block">Pay only after you agree</b>
              <span>No lock-in. Delivered in {sourcingLeadDays || 5}–{(sourcingLeadDays || 5) + 2} days with GST tax invoice.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. WhatsApp Primary Action (§6.4 Item 4 & 5) ──────────────── */}
      <div className="space-y-2 pt-2">
        <a
          href={ownerWhatsAppUrl(whatsappMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="act act-chat act-big act-wide shadow-xs"
        >
          <MessageCircle size={20} />
          <span>Ask Price on WhatsApp</span>
        </a>

        <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--fg-quiet)] text-center">
          <Clock size={13} />
          <span>Usually answered within an hour (Mon–Sat, 9:00 AM – 7:30 PM)</span>
        </div>
      </div>

      {/* ── 4. Four-Field Callback Form (§6.4 Item 6) ─────────────────── */}
      <div className="pt-4 border-t border-[var(--brass-line)]">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)] mb-1">
          Or Request an Instant Callback
        </h4>
        <p className="text-xs text-[var(--fg-muted)] mb-4">
          Prefer a phone call? Leave your number and our trade engineer will reach out.
        </p>

        {result ? (
          <div
            className={cn(
              "p-4 rounded text-xs flex items-start gap-2.5",
              result.ok ? "bg-[var(--verdigris-wash)] text-[var(--verdigris-700)] border border-[var(--verdigris-700)]/20" : "bg-red-50 text-[var(--signal-700)] border border-red-200"
            )}
          >
            {result.ok ? <Check size={16} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />}
            <p className="font-semibold">{result.message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Field 1: Name */}
            <div className="fld">
              <label htmlFor="inq-name" className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                Your Full Name *
              </label>
              <input
                id="inq-name"
                type="text"
                required
                placeholder="e.g. Ramesh Patel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="inp text-sm bg-white"
              />
            </div>

            {/* Field 2: Mobile Number */}
            <div className="fld">
              <label htmlFor="inq-phone" className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                10-Digit Mobile Number *
              </label>
              <input
                id="inq-phone"
                type="tel"
                required
                inputMode="tel"
                maxLength={10}
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                className="inp text-sm bg-white font-mono"
              />
            </div>

            {/* Row: Field 3 (Quantity) + Field 4 (Pin Code) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="fld">
                <label htmlFor="inq-qty" className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  Quantity
                </label>
                <input
                  id="inq-qty"
                  type="number"
                  min="1"
                  max="1000"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="inp text-sm bg-white font-mono"
                />
              </div>

              <div className="fld">
                <label htmlFor="inq-pin" className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  Delivery PIN Code
                </label>
                <input
                  id="inq-pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="e.g. 221404"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                  className="inp text-sm bg-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="act act-ink act-wide min-h-[48px] text-sm mt-1"
            >
              <Send size={15} />
              <span>{isPending ? "Submitting Request..." : "Request Price Callback"}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
