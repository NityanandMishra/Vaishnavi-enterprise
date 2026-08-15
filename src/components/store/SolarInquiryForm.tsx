"use client";

import { useState, useTransition } from "react";
import {
  Sun,
  Lightbulb,
  HelpCircle,
  Check,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Phone,
} from "lucide-react";
import { cn, ownerWhatsAppUrl } from "@/lib/utils";
import { submitSolarInquiry } from "@/app/(store)/actions";

/**
 * Three-step solar consultancy enquiry.
 *
 * Contact details are asked last on purpose: by then the visitor has already
 * invested effort, so the phone number reads as the final step of a request
 * rather than a toll gate. WhatsApp is offered only after submission — never
 * as the entry point.
 */

type Interest = "ROOFTOP" | "LIGHTING" | "UNSURE";

const INTERESTS: { value: Interest; label: string; hint: string; icon: typeof Sun }[] = [
  {
    value: "ROOFTOP",
    label: "Rooftop solar for my home",
    hint: "Cut your monthly electricity bill",
    icon: Sun,
  },
  {
    value: "LIGHTING",
    label: "Solar lighting",
    hint: "Street, gate, and outdoor area lights",
    icon: Lightbulb,
  },
  {
    value: "UNSURE",
    label: "Not sure — advise me",
    hint: "We'll help you work out what fits",
    icon: HelpCircle,
  },
];

const PROPERTY_TYPES = ["Independent house", "Housing society", "Shop / small establishment"];
const BILL_BANDS = ["Under ₹1,500", "₹1,500 – ₹3,000", "₹3,000 – ₹6,000", "Above ₹6,000"];
const ROOF_AREAS = ["Under 300 sq ft", "300 – 600 sq ft", "Above 600 sq ft", "Not sure"];
const TIMELINES = ["As soon as possible", "In 1–3 months", "Just exploring"];

const STEPS = ["What you need", "Your requirement", "Contact details"];

function OptionGrid({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  columns?: number;
}) {
  return (
    <div className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            "min-h-[48px] px-3 py-2.5 rounded-md border text-sm font-medium text-left transition-colors",
            value === opt
              ? "border-brand-orange-600 bg-brand-orange-50 text-slate-900"
              : "border-border-base bg-surface text-slate-700 hover:border-slate-400"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
  optional,
}: {
  label: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
        {label}
        {optional && <span className="font-medium normal-case tracking-normal"> (optional)</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full min-h-[48px] px-3 rounded-md border border-border-base bg-surface text-sm text-slate-900 placeholder-muted outline-none focus:ring-2 focus:ring-slate-900 transition-shadow";

export default function SolarInquiryForm() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [interest, setInterest] = useState<Interest | "">("");
  const [propertyType, setPropertyType] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [monthlyBill, setMonthlyBill] = useState("");
  const [roofArea, setRoofArea] = useState("");
  const [timeline, setTimeline] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Roof size and bill only make sense for a rooftop system.
  const showRooftopFields = interest === "ROOFTOP" || interest === "UNSURE";

  function next() {
    setError(null);
    if (step === 0) {
      if (!interest) return setError("Please choose what you're looking for.");
      if (!city.trim()) return setError("Please enter your city.");
      if (!/^\d{6}$/.test(pincode.trim())) return setError("Enter a valid 6-digit pincode.");
    }
    setStep((s) => s + 1);
  }

  function back() {
    setError(null);
    setStep((s) => s - 1);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("interest", interest);
    formData.set("propertyType", propertyType);
    formData.set("city", city);
    formData.set("pincode", pincode);
    formData.set("monthlyBill", monthlyBill);
    formData.set("roofArea", roofArea);
    formData.set("timeline", timeline);
    formData.set("name", name);
    formData.set("phone", phone);
    formData.set("email", email);
    formData.set("notes", notes);

    startTransition(async () => {
      const res = await submitSolarInquiry(null, formData);
      if (res.ok) setDone({ reference: res.reference });
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div className="bg-surface border border-border-base rounded-lg p-6 lg:p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <Check size={24} />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Request received</h3>
        <p className="text-sm text-slate-600 mb-1">
          Our team will call you on <span className="font-semibold text-slate-900">{phone}</span>{" "}
          within 1 working day to schedule your free site assessment.
        </p>
        <p className="text-xs text-muted mb-6">
          Reference <span className="font-mono font-semibold">{done.reference}</span>
        </p>

        <div className="border-t border-border-base pt-5">
          <p className="text-xs text-slate-500 mb-3">Need to reach us sooner?</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <a
              href="tel:+917388847575"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-md border border-border-base text-sm font-semibold text-slate-700 hover:border-slate-400 transition-colors"
            >
              <Phone size={16} />
              +91 73888 47575
            </a>
            <a
              href={ownerWhatsAppUrl(
                `Hello, I submitted a solar enquiry (ref ${done.reference}) and would like to follow up.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-md border border-border-base text-sm font-semibold text-slate-700 hover:border-slate-400 transition-colors"
            >
              <MessageCircle size={16} />
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-border-base rounded-lg p-5 lg:p-7"
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={cn(
                "h-1 rounded-full transition-colors",
                i <= step ? "bg-brand-orange-600" : "bg-border-base"
              )}
            />
            <span
              className={cn(
                "text-[11px] font-semibold mt-1.5 block",
                i === step ? "text-slate-900" : "text-muted"
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
              What are you looking for?
            </span>
            <div className="grid gap-2">
              {INTERESTS.map(({ value, label, hint, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setInterest(value)}
                  aria-pressed={interest === value}
                  className={cn(
                    "flex items-start gap-3 p-3.5 rounded-md border text-left transition-colors",
                    interest === value
                      ? "border-brand-orange-600 bg-brand-orange-50"
                      : "border-border-base hover:border-slate-400"
                  )}
                >
                  <Icon
                    size={20}
                    className={cn(
                      "flex-shrink-0 mt-0.5",
                      interest === value ? "text-brand-orange-600" : "text-slate-400"
                    )}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-500">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Bhadohi"
                className={inputClass}
              />
            </Field>
            <Field label="Pincode">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                placeholder="221404"
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          {showRooftopFields && (
            <>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Property type
                </span>
                <OptionGrid
                  options={PROPERTY_TYPES}
                  value={propertyType}
                  onChange={setPropertyType}
                  columns={1}
                />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Average monthly electricity bill
                </span>
                <OptionGrid options={BILL_BANDS} value={monthlyBill} onChange={setMonthlyBill} />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Rooftop area available
                </span>
                <OptionGrid options={ROOF_AREAS} value={roofArea} onChange={setRoofArea} />
              </div>
            </>
          )}

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
              When are you looking to start?
            </span>
            <OptionGrid options={TIMELINES} value={timeline} onChange={setTimeline} columns={1} />
          </div>

          <Field label="Anything else we should know" optional>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Tell us about your roof, existing wiring, or any specific requirement."
              className={cn(inputClass, "py-2.5 min-h-[80px] resize-y")}
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Last step — tell us where to reach you. We'll call to schedule a free site assessment.
          </p>
          <Field label="Your name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className={inputClass}
            />
          </Field>
          <Field label="Mobile number">
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              className={inputClass}
            />
          </Field>
          <Field label="Email" optional>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </Field>
          <p className="text-xs text-muted">
            We use your number only to discuss this enquiry. No marketing spam.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 text-sm text-rose-600">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 mt-6">
        {step > 0 && (
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1.5 min-h-[48px] px-4 rounded-md border border-border-base text-sm font-semibold text-slate-700 hover:border-slate-400 transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[48px] px-4 rounded-md bg-slate-900 text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 transition-opacity"
          >
            Continue
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[48px] px-4 rounded-md bg-brand-orange-600 text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {isPending ? "Sending…" : "Request free assessment"}
          </button>
        )}
      </div>
    </form>
  );
}
