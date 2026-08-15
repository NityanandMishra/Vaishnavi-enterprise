"use client";

import { useState, useTransition } from "react";
import { FileText, MessageCircle, Check, AlertCircle, X } from "lucide-react";
import { cn, formatINR, ownerWhatsAppUrl } from "@/lib/utils";
import { submitLead } from "@/app/(store)/actions";

export default function ProductInquiryBox({
  productId,
  productTitle,
  basePrice,
}: {
  productId: string;
  productTitle: string;
  basePrice: number;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("productId", productId);

    startTransition(async () => {
      const response = await submitLead(null, formData);
      if (response.ok) {
        setResult({ ok: true, message: "Thanks — our team will call you shortly." });
        setOpen(false);
      } else {
        setResult({ ok: false, message: response.error });
      }
    });
  }

  const actions = (
    <>
      <button
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
        className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-md bg-slate-900 text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 transition-opacity"
      >
        <FileText size={17} />
        Request Quote
      </button>
      <a
        href={ownerWhatsAppUrl(`Hi, I'd like a quote for: ${productTitle}`)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-md bg-whatsapp text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 transition-opacity"
      >
        <MessageCircle size={17} />
        WhatsApp Enquiry
      </a>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border-base rounded-lg p-5">
        <p className="text-xs font-medium text-slate-600 mb-1">Starting Price (Ex-Showroom)</p>
        <p className="text-2xl font-bold text-brand-orange-600">
          {formatINR(basePrice)}
          <span className="align-super text-base">*</span>
        </p>
        <p className="text-xs text-slate-600 mt-1">
          *Final price varies by configuration, subsidies and location. T&amp;C apply.
        </p>
      </div>

      {result && (
        <p
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            result.ok ? "text-success" : "text-danger"
          )}
          role="status"
        >
          {result.ok ? <Check size={16} /> : <AlertCircle size={16} />}
          {result.message}
        </p>
      )}

      {/* Desktop actions */}
      <div className="hidden lg:flex flex-col gap-3">{actions}</div>

      {/* Mobile sticky action bar, sitting above the bottom nav */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 flex gap-3 p-3 bg-surface border-t border-border-base shadow-lg">
        {actions}
      </div>

      {/* Quote request modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center">
          <button
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-label="Close"
          />
          <div className="relative w-full lg:max-w-md bg-surface rounded-t-xl lg:rounded-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-surface flex items-center justify-between px-5 py-4 border-b border-border-base">
              <h2 className="text-base font-semibold text-slate-900">Request a Quote</h2>
              <button onClick={() => setOpen(false)} className="p-2 -mr-2 text-slate-500" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <p className="text-sm text-slate-600">
                For <span className="font-semibold text-slate-900">{productTitle}</span>
              </p>

              {[
                { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Your name" },
                { name: "phone", label: "Mobile Number", type: "tel", required: true, placeholder: "10-digit mobile" },
                { name: "email", label: "Email (optional)", type: "email", required: false, placeholder: "you@example.com" },
                { name: "city", label: "City (optional)", type: "text", required: false, placeholder: "Your city" },
                { name: "pincode", label: "Pincode (optional)", type: "text", required: false, placeholder: "6-digit pincode" },
              ].map((field) => (
                <div key={field.name}>
                  <label
                    htmlFor={`lead-${field.name}`}
                    className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5"
                  >
                    {field.label}
                  </label>
                  <input
                    id={`lead-${field.name}`}
                    name={field.name}
                    type={field.type}
                    required={field.required}
                    placeholder={field.placeholder}
                    className="w-full min-h-[44px] px-3 bg-surface border border-border-base rounded-md text-sm text-slate-900 placeholder-muted focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              ))}

              <div>
                <label
                  htmlFor="lead-message"
                  className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5"
                >
                  Requirement (optional)
                </label>
                <textarea
                  id="lead-message"
                  name="message"
                  rows={3}
                  placeholder="Quantity, configuration, timelines…"
                  className="w-full px-3 py-2.5 bg-surface border border-border-base rounded-md text-sm text-slate-900 placeholder-muted focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {result && !result.ok && (
                <p className="flex items-center gap-1.5 text-sm font-medium text-danger">
                  <AlertCircle size={16} />
                  {result.message}
                </p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full min-h-[48px] rounded-md bg-slate-900 text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? "Submitting…" : "Submit Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
