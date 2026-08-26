"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowRight,
  UserPlus,
} from "lucide-react";
import { registerCustomer } from "../actions";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await registerCustomer(null, formData);
      if (result.ok) {
        router.push("/auth/login?registered=1");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-8 relative overflow-hidden">
      {/* Top ambient glow inside card */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-brand-orange-500 to-transparent" />

      {/* Card Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-[11px] font-semibold text-slate-300 mb-3">
          <UserPlus size={12} className="text-brand-orange-400" />
          <span>New Customer Registration</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Create Account</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Save multiple delivery addresses, track real-time orders, and manage wishlist items.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="reg-name"
            className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5"
          >
            Full Name <span className="text-brand-orange-400">*</span>
          </label>
          <div className="relative">
            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="reg-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="e.g. Ramesh Kumar"
              className="w-full h-11 pl-10 pr-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 transition-all"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="reg-email"
            className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5"
          >
            Email Address <span className="text-brand-orange-400">*</span>
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="reg-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full h-11 pl-10 pr-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 transition-all"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="reg-phone"
            className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5"
          >
            Mobile Number <span className="text-brand-orange-400">*</span>
          </label>
          <div className="relative">
            <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="reg-phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              placeholder="10-digit mobile number"
              className="w-full h-11 pl-10 pr-3.5 font-mono bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 transition-all"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="reg-password"
            className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5"
          >
            Password <span className="text-brand-orange-400">*</span>
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="reg-password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="w-full h-11 pl-10 pr-11 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-brand-orange-600 to-brand-orange-500 hover:from-brand-orange-500 hover:to-brand-orange-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-brand-orange-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {isPending && <Loader2 size={16} className="animate-spin" />}
          <span>{isPending ? "Creating Account…" : "Register Account"}</span>
          {!isPending && <ArrowRight size={14} />}
        </button>
      </form>

      <p className="text-xs text-slate-400 text-center mt-6">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="font-bold text-brand-orange-400 hover:text-brand-orange-300 transition-colors"
        >
          Sign In
        </Link>
      </p>
    </div>
  );
}
