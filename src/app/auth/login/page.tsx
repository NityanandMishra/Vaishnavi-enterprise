"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  User,
  ArrowRight,
  Sparkles,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "";
  const justRegistered = searchParams.get("registered") === "1";
  const sessionExpired = searchParams.get("error") === "SessionRequired";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirectingRole, setRedirectingRole] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const result = await signIn("credentials", {
      email: cleanEmail,
      password,
      redirect: false,
    });

    if (result?.error) {
      setLoading(false);
      setError("Invalid email or password. Please check your credentials.");
      return;
    }

    // Determine user role and route intelligently
    try {
      const session = await getSession();
      const role = (session?.user as any)?.role;

      if (role === "ADMIN" || role === "SUPER_ADMIN" || role === "CATALOG_MANAGER") {
        setRedirectingRole("ADMIN");
        const target = callbackUrl.startsWith("/admin") ? callbackUrl : "/admin";
        setTimeout(() => {
          router.push(target);
          router.refresh();
        }, 500);
      } else {
        setRedirectingRole("CUSTOMER");
        const target =
          callbackUrl && !callbackUrl.startsWith("/admin") ? callbackUrl : "/account";
        setTimeout(() => {
          router.push(target);
          router.refresh();
        }, 500);
      }
    } catch (_) {
      // Fallback
      router.push("/account");
      router.refresh();
    }
  }

  function handleFillCredentials(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-8 relative overflow-hidden">
      {/* Top ambient glow inside card */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-brand-orange-500 to-transparent" />

      {/* Card Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-[11px] font-semibold text-slate-300 mb-3">
          <Shield size={12} className="text-brand-orange-400" />
          <span>Unified Access Portal</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Sign In</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Enter your credentials. Admins will be routed to the Admin Console and customers to their
          profile.
        </p>
      </div>

      {/* Status Messages */}
      {justRegistered && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2 mb-4">
          <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
          <span>Account created successfully. Please sign in below.</span>
        </div>
      )}

      {sessionExpired && (
        <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl text-amber-300 text-xs flex items-center gap-2 mb-4">
          <AlertCircle size={15} className="text-amber-400 flex-shrink-0" />
          <span>Your session has expired. Please sign in again.</span>
        </div>
      )}

      {redirectingRole && (
        <div className="p-3 bg-brand-orange-950/40 border border-brand-orange-800/50 rounded-xl text-brand-orange-200 text-xs flex items-center justify-center gap-2 mb-4 animate-pulse">
          <Loader2 size={15} className="animate-spin text-brand-orange-400" />
          <span>
            {redirectingRole === "ADMIN"
              ? "Verified Admin — Navigating to Admin Portal…"
              : "Welcome back! Navigating to your Account…"}
          </span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5"
          >
            Email Address
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@vaishnavi.com or personal email"
              className="w-full h-11 pl-10 pr-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 transition-all font-sans"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 pl-10 pr-11 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange-500/50 focus:border-brand-orange-500 transition-all font-sans"
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
          disabled={loading || !!redirectingRole}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-brand-orange-600 to-brand-orange-500 hover:from-brand-orange-500 hover:to-brand-orange-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-brand-orange-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          <span>{loading ? "Verifying Credentials…" : "Sign In to Account"}</span>
          {!loading && <ArrowRight size={14} />}
        </button>
      </form>

      {/* Quick Credentials / Demo One-Click Fill */}
      <div className="mt-6 pt-5 border-t border-slate-800/80">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center mb-2.5 flex items-center justify-center gap-1">
          <Sparkles size={12} className="text-brand-orange-400" />
          <span>Quick Login Test Shortcuts:</span>
        </p>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleFillCredentials("admin@vaishnavi.com", "admin123")}
            className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 hover:border-brand-orange-500/40 hover:bg-slate-800/60 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 font-bold text-slate-200 group-hover:text-brand-orange-400 text-[11px]">
              <Shield size={12} />
              <span>Admin Role</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
              admin@vaishnavi.com
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleFillCredentials("customer@gmail.com", "customer123")}
            className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-800/60 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 font-bold text-slate-200 group-hover:text-blue-400 text-[11px]">
              <User size={12} />
              <span>Customer Role</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
              customer@gmail.com
            </p>
          </button>
        </div>
      </div>

      {/* Register Link */}
      <p className="text-xs text-slate-400 text-center mt-6">
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/register"
          className="font-bold text-brand-orange-400 hover:text-brand-orange-300 transition-colors"
        >
          Create Customer Account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 h-96 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-brand-orange-500" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
