import Link from "next/link";
import Logo from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-alt flex flex-col items-center justify-center p-4">
      <Link href="/" aria-label="Vaishnavi Enterprises — home" className="ve-logo-link mb-8">
        <Logo size="lg" emphasis />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <Link
        href="/"
        className="mt-8 text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        ← Back to store
      </Link>
    </div>
  );
}
