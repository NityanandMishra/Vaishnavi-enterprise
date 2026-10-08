import Link from "next/link";
import { Phone, Mail, MapPin, ShieldCheck, Truck, Banknote, Zap } from "lucide-react";
import { ownerWhatsAppUrl } from "@/lib/utils";

const categoryLinks = [
  { label: "Fans & BLDC Coolers", href: "/categories/fans" },
  { label: "Copper House Wires", href: "/categories/electrical-wires" },
  { label: "LED Lighting & Battens", href: "/categories/led-lighting" },
  { label: "Modular Switches & MCBs", href: "/categories/electrical-fittings" },
  { label: "Inverters & Home UPS", href: "/categories/ups-systems" },
  { label: "Water Heaters & Geysers", href: "/categories/home-appliances" },
  { label: "Electric Scooties & Loaders", href: "/categories/electric-vehicles" },
];

const policyLinks = [
  { label: "GST Billing & Tax Invoices", href: "/policies/shipping" },
  { label: "Shipping & Delivery Timelines", href: "/policies/shipping" },
  { label: "Return & Damage Claims", href: "/policies/returns" },
  { label: "Warranty Support Procedure", href: "/policies/terms" },
  { label: "Terms of Trade", href: "/policies/terms" },
];

/**
 * Storefront Footer (§5.5)
 *
 * Implements 4-column layout at ≥768px, 2-column below.
 * Prominently surfaces the official GSTIN and physical counter address
 * as genuine trust markers for trade and local buyers.
 */
export default function StorefrontFooter() {
  return (
    <footer className="base border-t border-[var(--steel-600)]">
      <div className="wrap">
        <div className="base-grid">
          {/* Column 1: Brand & Firm Identity */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-white">
              <div className="w-8 h-8 rounded bg-[var(--copper-600)] flex items-center justify-center font-bold text-white">
                <Zap size={18} className="fill-white" />
              </div>
              <h3 className="font-bold text-lg tracking-tight">VAISHNAVI ENTERPRISES</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Authorised distributor & direct retailer for Crompton, Havells, Polycab, Finolex, Microtek, and ZOE Motors.
            </p>
            <div className="p-3 rounded bg-white/5 border border-white/10 text-xs text-slate-300 space-y-1">
              <div>
                <b className="text-white">GSTIN:</b> 09AABCV1234K1Z5
              </div>
              <div>
                <b className="text-white">Trade Desk:</b> Station Road, Suriyawan, Bhadohi, UP 221404
              </div>
              <div>
                <b className="text-white">Dispatch:</b> Mon–Sat, 9:00 AM – 7:30 PM
              </div>
            </div>
          </div>

          {/* Column 2: Trade Categories */}
          <div>
            <h4>Shop Categories</h4>
            <div className="space-y-1">
              {categoryLinks.map((link) => (
                <Link key={link.label} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Column 3: Trust & Policies */}
          <div>
            <h4>Trade Policies</h4>
            <div className="space-y-1">
              {policyLinks.map((link) => (
                <Link key={link.label} href={link.href}>
                  {link.label}
                </Link>
              ))}
              <Link href="/solar" className="text-[var(--copper-lit)] font-semibold mt-2 inline-block">
                Solar Rooftop Survey →
              </Link>
            </div>
          </div>

          {/* Column 4: Local Counter & Direct Contact */}
          <div>
            <h4>Counter Assistance</h4>
            <div className="space-y-3 text-sm text-slate-300">
              <a
                href={ownerWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-white font-semibold hover:text-[var(--copper-lit)] transition-colors"
              >
                <Phone size={15} className="text-[var(--verdigris-700)]" />
                <span>+91 73888 47575</span>
              </a>

              <a
                href="mailto:contact@vaishnavi-enterprises.in"
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Mail size={15} />
                <span>contact@vaishnavi-enterprises.in</span>
              </a>

              <div className="flex items-start gap-2 text-xs text-slate-400">
                <MapPin size={15} className="flex-shrink-0 mt-0.5" />
                <span>Near Railway Crossing, Station Road, Suriyawan, District Bhadohi (UP) - 221404</span>
              </div>
            </div>
          </div>
        </div>

        {/* Assurance Pills */}
        <div className="flex flex-wrap gap-4 py-6 my-8 border-y border-white/10 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[var(--copper-lit)]" />
            <span>100% Genuine Authorised Distribution</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-[var(--copper-lit)]" />
            <span>Pan-India Surface & Express Logistics</span>
          </div>
          <div className="flex items-center gap-2">
            <Banknote size={16} className="text-[var(--copper-lit)]" />
            <span>Cash on Delivery across Serviceable Pincodes</span>
          </div>
        </div>

        {/* Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Vaishnavi Enterprises. All rights reserved.</p>
          <p>Prices include GST where applicable. Commercial trade quotes available on request.</p>
        </div>
      </div>
    </footer>
  );
}
