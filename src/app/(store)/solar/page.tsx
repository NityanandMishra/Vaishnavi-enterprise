import type { Metadata } from "next";
import Link from "next/link";
import { Sun, Lightbulb, ClipboardList, FileText, Wrench, HeadphonesIcon, ShieldCheck, MapPin } from "lucide-react";
import SolarInquiryForm from "@/components/store/SolarInquiryForm";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import SolarCalculator from "@/components/store/SolarCalculator";

export const metadata: Metadata = {
  title: "Solar Solutions & PM Surya Ghar Calculator | Vaishnavi Enterprises",
  description:
    "Calculate PM Surya Ghar Muft Bijli Yojana rooftop solar subsidy, electricity bill savings, and book free site survey in Suriyawan, Bhadohi and Eastern UP.",
};

const offerings = [
  {
    icon: Sun,
    title: "Rooftop solar for homes",
    body: "Grid-tied rooftop systems for independent houses, housing societies, and small establishments. Sized to your actual consumption, installed and commissioned by our own local team.",
    points: ["Site survey before any quote", "Genuine tier-1 panels and inverters", "Full GST invoice on every order"],
  },
  {
    icon: Lightbulb,
    title: "Solar lighting",
    body: "Standalone solar street lights, gate lights, and outdoor area lighting — zero wiring runs, no meter load, and nothing added to your monthly bill.",
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
    <div className="min-h-screen bg-[var(--bg)] pb-16">
      <div className="wrap pt-4 pb-2">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Solar Solutions" }]} />
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative bg-[var(--ink-900)] text-white overflow-hidden py-14 lg:py-20 border-b border-[var(--line-soft)]">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 75% 30%, var(--copper-lit), transparent 50%)",
          }}
        />
        <div className="relative wrap lg:flex lg:items-center lg:gap-16">
          <div className="lg:flex-1">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-[var(--copper-lit)] mb-3">
              Solar Solutions & Services
            </span>
            <h1 className="text-3xl lg:text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight">
              Lower your electricity bill, permanently
            </h1>
            <p className="text-base lg:text-lg text-[#C8D5E0] max-w-xl mb-6 leading-relaxed">
              Rooftop solar for homes and housing societies, and solar lighting for gates,
              lanes, and outdoor areas. We survey your site first, then quote — so the
              system you get is the one you actually need.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#A9BCC9]">
              {assurances.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2">
                  <Icon size={16} className="text-[var(--copper-lit)]" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="hidden lg:block lg:w-[420px] flex-shrink-0" />
        </div>
      </section>

      <div className="wrap">
        <div className="lg:flex lg:gap-12 lg:items-start">
          {/* ── Left: the offer ──────────────────────────────────────── */}
          <div className="lg:flex-1 pt-10 lg:pt-14 space-y-12">
            <section>
              <h2 className="text-2xl font-bold text-[var(--fg)] mb-5 tracking-tight">
                What we install
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {offerings.map(({ icon: Icon, title, body, points }) => (
                  <div
                    key={title}
                    className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 flex flex-col"
                  >
                    <Icon size={24} className="text-[var(--accent)] mb-3" />
                    <h3 className="text-base font-bold text-[var(--fg)] mb-2">{title}</h3>
                    <p className="text-sm text-[var(--fg-muted)] leading-relaxed mb-4">{body}</p>
                    <ul className="mt-auto space-y-1.5 pt-3 border-t border-[var(--line-soft)]">
                      {points.map((p) => (
                        <li key={p} className="text-xs text-[var(--fg-muted)] flex items-start gap-2">
                          <span className="text-[var(--accent)] mt-0.5">•</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[var(--fg)] mb-2 tracking-tight">
                How it works
              </h2>
              <p className="text-sm text-[var(--fg-muted)] mb-6">
                Four steps from enquiry to a working system. You are never charged for the
                assessment or the proposal.
              </p>
              <ol className="grid gap-4 sm:grid-cols-2">
                {steps.map(({ icon: Icon, title, body }, i) => (
                  <li
                    key={title}
                    className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 flex gap-4"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--accent-wash)] text-[var(--accent)] flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--fg)] mb-1">{title}</h3>
                      <p className="text-xs text-[var(--fg-muted)] leading-relaxed">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-6 grid gap-5 sm:grid-cols-3">
                {assurances.map(({ icon: Icon, label, body }) => (
                  <div key={label}>
                    <Icon size={20} className="text-[var(--accent)] mb-2" />
                    <h3 className="text-sm font-bold text-[var(--fg)] mb-1">{label}</h3>
                    <p className="text-xs text-[var(--fg-muted)] leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <p className="text-xs text-[var(--fg-muted)] pt-4">
              Looking for commercial solar installations or bulk panels? That is handled under our trade quote desk —{" "}
              <Link href="/products/havells-solar-panel-550w-mono-perc" className="underline hover:text-[var(--accent)]">
                view 550W Mono PERC solar panels
              </Link>{" "}
              or message us directly on WhatsApp.
            </p>
          </div>

          {/* ── Right: the form (sticky on desktop) ──────────────────── */}
          <div className="lg:w-[420px] flex-shrink-0 pt-10 lg:pt-0 lg:-mt-20 pb-4">
            <div className="lg:sticky lg:top-24">
              <div className="mb-4 bg-[var(--surface)] p-4 rounded-t-lg border border-b-0 border-[var(--line)]">
                <h2 className="text-lg font-bold text-[var(--fg)]">
                  Book a free site assessment
                </h2>
                <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                  Three quick questions. No payment, zero obligation.
                </p>
              </div>
              <SolarInquiryForm />
            </div>
          </div>
        </div>

        {/* ── Solar Sizing Calculator Section ────────────────────────────── */}
        <section className="py-12 lg:py-16 border-t border-[var(--line)] mt-12">
          <SolarCalculator />
        </section>
      </div>
    </div>
  );
}
