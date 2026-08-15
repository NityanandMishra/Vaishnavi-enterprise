import Link from "next/link";
import { Phone, Mail, MapPin, Instagram, Facebook, ShieldCheck, Truck, Banknote } from "lucide-react";
import { ownerWhatsAppUrl } from "@/lib/utils";

const footerLinks = {
  "Shop": [
    { label: "Electric Vehicles", href: "/categories/electric-vehicles" },
    { label: "Fans & Blowers", href: "/categories/fans" },
    { label: "LED Lighting", href: "/categories/led-lighting" },
    { label: "UPS & Power Backups", href: "/categories/ups-systems" },
  ],
  "Customer Support": [
    { label: "Shipping Policy", href: "/policies/shipping" },
    { label: "Return Policy", href: "/policies/returns" },
    { label: "Privacy Policy", href: "/policies/privacy" },
    { label: "Terms & Conditions", href: "/policies/terms" },
  ],
  "Account": [
    { label: "My Orders", href: "/account" },
    { label: "Wishlist", href: "/wishlist" },
    { label: "Address Book", href: "/account" },
    { label: "Login / Register", href: "/auth/login" },
  ],
};

const trustBadges = [
  { icon: ShieldCheck, label: "GST Invoice" },
  { icon: Truck, label: "Pan-India Shipping" },
  { icon: Banknote, label: "COD Available" },
];

export default function StorefrontFooter() {
  return (
    <footer className="mt-16 bg-surface-inverse text-white border-b-8 border-brand-orange-600">
      <div className="max-w-content mx-auto px-4 lg:px-8 pt-12 pb-6">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              aria-label="Vaishnavi Enterprises — home"
              className="inline-flex mb-4"
            >
              <img src="/logo-inverse.png" alt="Vaishnavi Enterprises" className="h-10 w-auto object-contain" />
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Technical expertise for industrial-grade solar, EV, LED, and electrical components. Suriyawan, Bhadohi.
            </p>
            <div className="flex flex-wrap gap-2">
              {trustBadges.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded-md bg-white/10 text-slate-200"
                >
                  <Icon size={12} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact Strip */}
        <div className="flex flex-wrap gap-x-6 gap-y-3 py-6 border-t border-white/10 text-sm text-slate-400">
          <a
            href={ownerWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-whatsapp transition-colors"
          >
            <Phone size={15} />
            +91 73888 47575
          </a>
          <a
            href="mailto:info@vaishnavi-enterprises.in"
            className="flex items-center gap-2 hover:text-brand-orange-400 transition-colors"
          >
            <Mail size={15} />
            info@vaishnavi-enterprises.in
          </a>
          <span className="flex items-center gap-2">
            <MapPin size={15} />
            Suriyawan, Bhadohi, Uttar Pradesh
          </span>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Vaishnavi Enterprises. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" aria-label="Instagram" className="hover:text-white transition-colors"><Instagram size={16} /></a>
            <a href="#" aria-label="Facebook" className="hover:text-white transition-colors"><Facebook size={16} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
