import React from "react";
import Link from "next/link";
import { Zap, ShieldCheck, ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none selection:bg-brand-orange-500 selection:text-white">
      {/* Background ambient lighting effects */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 10%, rgba(234, 88, 12, 0.25), transparent 45%), radial-gradient(circle at 10% 90%, rgba(37, 99, 235, 0.2), transparent 45%), radial-gradient(circle at 90% 80%, rgba(124, 58, 237, 0.15), transparent 45%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 group transition-transform hover:scale-[1.02]"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange-500 to-brand-orange-600 flex items-center justify-center shadow-lg shadow-brand-orange-600/30 text-white">
            <Zap size={22} className="fill-white" />
          </div>
          <div>
            <span className="font-heading font-black text-lg tracking-tight text-white block leading-none">
              VAISHNAVI
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange-400 block mt-0.5">
              ENTERPRISES
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 backdrop-blur-md transition-all hover:border-slate-700"
        >
          <ArrowLeft size={14} />
          <span>Back to Store</span>
        </Link>
      </header>

      {/* Center Form Container */}
      <main className="relative z-10 w-full max-w-md mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-900/60">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-emerald-500" />
          <span>256-Bit SSL Encrypted & Protected Session</span>
        </div>
        <p>© {new Date().getFullYear()} Vaishnavi Enterprises. All rights reserved.</p>
      </footer>
    </div>
  );
}
