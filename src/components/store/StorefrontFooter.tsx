import Link from "next/link";
import { Zap, Phone, Mail, MapPin, Instagram, Facebook } from "lucide-react";
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
    { label: "My Orders", href: "/account/orders" },
    { label: "Wishlist", href: "/wishlist" },
    { label: "Address Book", href: "/account/addresses" },
    { label: "Login / Register", href: "/auth/login" },
  ],
};

export default function StorefrontFooter() {
  return (
    <footer className="border-t border-white/5 bg-slate-950/80 mt-16">
      <div className="max-w-7xl mx-auto px-4 pt-12 pb-6">

        {/* Top Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-orange-500 to-brand-orange-700">
                <Zap size={20} fill="white" color="white" />
              </div>
              <div>
                <p className="font-heading font-bold text-base text-white leading-tight">Vaishnavi</p>
                <p className="text-[10px] text-slate-400 leading-tight tracking-widest uppercase">Enterprises</p>
              </div>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Your trusted partner for EV mobility, high-performance fans, modular electrical fittings, and robust UPS backups in Suriyawan, Bhadohi.
            </p>
            {/* Trust Badges */}
            <div className="flex flex-wrap gap-2">
              {["GST Registered", "Pan-India Shipping", "COD Available", "Genuine Products"].map((badge) => (
                <span key={badge} className="text-[10px] font-medium px-2 py-1 rounded-full bg-brand-orange-950/40 text-brand-orange-400 border border-brand-orange-850/50">
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-heading font-semibold text-sm text-white mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-slate-400 hover:text-brand-orange-400 transition-colors"
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
        <div className="flex flex-wrap gap-6 py-6 border-t border-white/5 text-sm text-slate-400">
          <a
            href={ownerWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-green-400 transition-colors"
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/5 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Vaishnavi Enterprises. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" aria-label="Instagram" className="hover:text-pink-400 transition-colors"><Instagram size={16} /></a>
            <a href="#" aria-label="Facebook" className="hover:text-blue-400 transition-colors"><Facebook size={16} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
