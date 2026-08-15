import type { Metadata } from "next";
import Link from "next/link";
import { Sun, Lightbulb, ClipboardList, FileText, Wrench, HeadphonesIcon, ShieldCheck, MapPin } from "lucide-react";
import SolarInquiryForm from "@/components/store/SolarInquiryForm";
import Breadcrumbs from "@/components/store/Breadcrumbs";

export const metadata: Metadata = {
  title: "Solar Solutions",
  description:
    "Rooftop solar for homes and housing societies, plus solar street and outdoor lighting. Free site assessment across Bhadohi and eastern Uttar Pradesh.",
};

/**
 * Solar consultancy landing page.
 *
 * Scope is deliberately limited to residential rooftop and solar lighting —
 * the two things the business actually delivers today. Commercial and
 * industrial rooftop is a future offering and is not advertised here.
 */

const offerings = [
  {
    icon: Sun,
    title: "Rooftop solar for homes",
    body: "Grid-tied rooftop systems for independent houses, housing societies, and small establishments. Sized to your actual consumption, installed and commissioned by our own team.",
    points: ["Site survey before any quote", "Genuine tier-1 panels and inverters", "GST invoice on every order"],
  },
  {
    icon: Lightbulb,
    title: "Solar lighting",
    body: "Standalone solar street lights, gate lights, and outdoor area lighting — no wiring runs, no meter load, and nothing added to your monthly bill.",
    points: ["Integrated panel and battery units", "Dusk-to-dawn automatic operation", "Suited to gates, lanes, and campuses"],
  },
];

const steps = [
  { icon: ClipboardList, title: "Share your requirement", body: "Tell us what you need and where. Takes under a minute." },
  { icon: MapPin, title: "Free site assessment", body: "We visit, measure your roof, and check your existing connection." },
  { icon: FileText, title: "Written proposal", body: "A clear quote with system size, components, and timeline. No obligation." },
  { icon: Wrench, title: "Installation & handover", body: "Our team installs, commissions, and walks you through operating it." },
];

const assurances = [
  { icon: ShieldCheck, label: "GST invoice", body: "Full tax invoice on every order." },
  { icon: HeadphonesIcon, label: "Local support", body: "Based in Suriyawan, Bhadohi — we service what we sell." },
  { icon: FileText, label: "No-obligation quote", body: "The site assessment and proposal cost you nothing." },
];

export default function SolarPage() {
  return (
    <>
      <div className="max-w-content mx-auto px-4 lg:px-8 pt-4">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Solar Solutions" }]} />
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative bg-surface-inverse overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 78% 25%, rgba(234,88,12,0.55), transparent 55%), radial-gradient(circle at 12% 85%, rgba(73,124,255,0.35), transparent 50%)",
          }}
        />
        <div className="relative max-w-content mx-auto px-4 lg:px-8 py-12 lg:py-20 lg:flex lg:items-center lg:gap-16">
          <div className="lg:flex-1">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-brand-orange-400 mb-3">
              Solar Solutions
            </span>
            <h1 className="text-3xl lg:text-5xl font-bold text-white leading-tight mb-4">
              Lower your electricity bill, permanently
            </h1>
            <p className="text-base lg:text-lg text-slate-300 max-w-xl mb-6">
              Rooftop solar for homes and housing societies, and solar lighting for gates,
              lanes, and outdoor areas. We survey your site first, then quote — so the
              system you get is the one you actually need.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
              {assurances.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2">
                  <Icon size={16} className="text-brand-orange-400" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="hidden lg:block lg:w-[420px] flex-shrink-0" />
        </div>
      </section>

      <div className="max-w-content mx-auto px-4 lg:px-8">
        <div className="lg:flex lg:gap-12 lg:items-start">
          {/* ── Left: the offer ──────────────────────────────────────── */}
          <div className="lg:flex-1 pt-12 lg:pt-16">
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-6">What we install</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {offerings.map(({ icon: Icon, title, body, points }) => (
                  <div
                    key={title}
                    className="bg-surface border border-border-base rounded-lg p-5 flex flex-col"
                  >
                    <Icon size={24} className="text-brand-orange-600 mb-3" />
                    <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed mb-4">{body}</p>
                    <ul className="mt-auto space-y-1.5">
                      {points.map((p) => (
                        <li key={p} className="text-xs text-slate-500 flex items-start gap-2">
                          <span className="text-brand-orange-600 mt-0.5">•</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="pt-12">
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">How it works</h2>
              <p className="text-sm text-slate-600 mb-6">
                Four steps from enquiry to a working system. You are never charged for the
                assessment or the proposal.
              </p>
              <ol className="grid gap-4 sm:grid-cols-2">
                {steps.map(({ icon: Icon, title, body }, i) => (
                  <li
                    key={title}
                    className="bg-surface border border-border-base rounded-lg p-5 flex gap-4"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-orange-50 text-brand-orange-600 flex items-center justify-center">
                      <Icon size={18} />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-0.5">
                        Step {i + 1}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="pt-12">
              <div className="bg-surface-sunken border border-border-base rounded-lg p-6 grid gap-5 sm:grid-cols-3">
                {assurances.map(({ icon: Icon, label, body }) => (
                  <div key={label}>
                    <Icon size={20} className="text-brand-orange-600 mb-2" />
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">{label}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <p className="text-xs text-muted pt-8">
              Looking for solar on a factory or commercial building? That is not something we
              take on yet —{" "}
              <Link href="/categories" className="underline hover:text-slate-700">
                browse our electrical range
              </Link>{" "}
              or call us and we will point you in the right direction.
            </p>
          </div>

          {/* ── Right: the form (sticky on desktop) ──────────────────── */}
          <div className="lg:w-[420px] flex-shrink-0 pt-12 lg:pt-0 lg:-mt-24 pb-4">
            <div className="lg:sticky lg:top-24">
              <div className="mb-4 lg:bg-surface lg:rounded-t-lg">
                <h2 className="text-lg font-semibold text-slate-900">
                  Book a free site assessment
                </h2>
                <p className="text-sm text-slate-600">
                  Three quick questions. No payment, no obligation.
                </p>
              </div>
              <SolarInquiryForm />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
