"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/account";
  const justRegistered = searchParams.get("registered") === "1";

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      password: String(formData.get("password") ?? ""),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password. Please try again.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="bg-surface border border-border-base rounded-lg p-6">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Sign in</h1>
      <p className="text-sm text-slate-600 mb-6">
        Access your orders, wishlist, and saved addresses.
      </p>

      {justRegistered && (
        <p className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-md px-3 py-2.5 mb-4">
          Account created — sign in to continue.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full min-h-[44px] px-3 bg-surface border border-border-base rounded-md text-sm text-slate-900 placeholder-muted focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full min-h-[44px] px-3 pr-11 bg-surface border border-border-base rounded-md text-sm text-slate-900 placeholder-muted focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-700 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-danger" role="alert">
            <AlertCircle size={16} />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-md bg-slate-900 text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading && <Loader2 size={17} className="animate-spin" />}
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p className="text-sm text-slate-600 text-center mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/auth/register" className="font-semibold text-brand-orange-600 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="bg-surface border border-border-base rounded-lg p-6 h-80" />}>
      <LoginForm />
    </Suspense>
  );
}
