"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-md border-2 border-danger text-danger text-sm font-bold uppercase tracking-wide hover:bg-danger/5 transition-colors"
    >
      <LogOut size={17} />
      Log Out
    </button>
  );
}
