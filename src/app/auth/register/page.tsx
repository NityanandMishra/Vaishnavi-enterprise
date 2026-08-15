"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
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

  const fields = [
    { name: "name", label: "Full Name", type: "text", placeholder: "Your name", autoComplete: "name" },
    { name: "email", label: "Email Address", type: "email", placeholder: "you@example.com", autoComplete: "email" },
    { name: "phone", label: "Mobile Number", type: "tel", placeholder: "10-digit mobile", autoComplete: "tel" },
  ];

  return (
    <div className="bg-surface border border-border-base rounded-lg p-6">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Create your account</h1>
      <p className="text-sm text-slate-600 mb-6">
        Track orders, save addresses, and build a wishlist.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label
              htmlFor={field.name}
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5"
            >
              {field.label}
            </label>
            <input
              id={field.name}
              name={field.name}
              type={field.type}
              required
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              className="w-full min-h-[44px] px-3 bg-surface border border-border-base rounded-md text-sm text-slate-900 placeholder-muted focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        ))}

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
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
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
          disabled={isPending}
          className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-md bg-slate-900 text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending && <Loader2 size={17} className="animate-spin" />}
          {isPending ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="text-sm text-slate-600 text-center mt-6">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-semibold text-brand-orange-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
