"use client";

import React, { useState, useTransition } from "react";
import { User, Mail, Phone, CheckCircle2, AlertCircle, Loader2, Save } from "lucide-react";
import { updateProfile } from "@/app/(store)/actions";
import SignOutButton from "@/components/store/SignOutButton";

export default function ProfileManager({
  user,
}: {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
}) {
  const [name, setName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("phone", phone);

    startTransition(async () => {
      const res = await updateProfile(null, formData);
      if (res.ok) {
        setSuccessMessage("Profile details updated successfully!");
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(res.error || "Failed to update profile.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border-base rounded-lg p-5 sm:p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-1">Personal Details</h2>
        <p className="text-xs text-slate-500 mb-6">
          Update your contact details for orders and notifications
        </p>

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-center gap-2">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 max-w-md text-xs">
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Full Name"
                className="w-full h-10 pl-9 pr-3 rounded border border-border-base text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange-600"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Email Address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                disabled
                value={user.email || ""}
                className="w-full h-10 pl-9 pr-3 rounded border border-border-base bg-slate-50 text-slate-500 text-xs cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Email address is linked to your account and cannot be changed.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Phone Number</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full h-10 pl-9 pr-3 font-mono rounded border border-border-base text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange-600"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-surface border border-border-base rounded-lg p-5 sm:p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-1">Account Security</h2>
        <p className="text-xs text-slate-500 mb-4">
          Sign out of your account on this browser session
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
