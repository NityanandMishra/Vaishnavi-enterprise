"use client";

import React, { useState, useTransition } from "react";
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Phone,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveAddress, deleteAddress, setDefaultAddress } from "@/app/(store)/actions";

export interface AddressItem {
  id: string;
  fullName: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  alternatePhone: string | null;
  isDefault: boolean;
}

export default function AddressManager({
  addresses,
}: {
  addresses: AddressItem[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenAdd() {
    setEditingAddress(null);
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(address: AddressItem) {
    setEditingAddress(address);
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    if (editingAddress) {
      formData.set("id", editingAddress.id);
    }

    startTransition(async () => {
      const res = await saveAddress(null, formData);
      if (res.ok) {
        setIsModalOpen(false);
      } else {
        setFormError(res.error || "Failed to save address.");
      }
    });
  }

  function handleDelete(addressId: string) {
    if (confirm("Are you sure you want to delete this address?")) {
      startTransition(async () => {
        await deleteAddress(addressId);
      });
    }
  }

  function handleSetDefault(addressId: string) {
    startTransition(async () => {
      await setDefaultAddress(addressId);
    });
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Saved Addresses</h2>
          <p className="text-xs text-slate-500">
            Manage your delivery destinations for faster checkout
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Plus size={15} />
          <span>Add New Address</span>
        </button>
      </div>

      {/* Address Cards Grid */}
      {addresses.length === 0 ? (
        <div className="p-8 bg-surface border border-border-base rounded-lg text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <MapPin size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">No saved addresses</h3>
          <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
            You haven't saved any addresses yet. Add your home or office address for fast checkout.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand-orange-600 hover:bg-brand-orange-700 text-white text-xs font-semibold transition-colors"
          >
            <Plus size={14} /> Add Address
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={cn(
                "bg-surface border rounded-lg p-5 flex flex-col justify-between transition-all",
                addr.isDefault
                  ? "border-brand-orange-600 ring-1 ring-brand-orange-600 shadow-sm"
                  : "border-border-base hover:border-slate-300"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{addr.fullName}</p>
                    {addr.isDefault && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-orange-50 text-brand-orange-700 border border-brand-orange-200">
                        Default
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {addr.addressLine1}
                  {addr.addressLine2 && `, ${addr.addressLine2}`}
                  <br />
                  {addr.city}, {addr.state} — <strong>{addr.pincode}</strong>
                </p>

                {addr.alternatePhone && (
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <Phone size={12} /> {addr.alternatePhone}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border-base text-xs">
                {!addr.isDefault ? (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(addr.id)}
                    disabled={isPending}
                    className="text-slate-500 hover:text-slate-900 font-medium transition-colors"
                  >
                    Set as Default
                  </button>
                ) : (
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} /> Default Address
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(addr)}
                    className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(addr.id)}
                    className="text-red-600 hover:text-red-800 flex items-center gap-1 font-medium"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Address Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="relative w-full max-w-lg bg-surface rounded-lg shadow-xl border border-border-base overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-border-base">
              <h3 className="text-sm font-bold text-slate-900">
                {editingAddress ? "Edit Address" : "Add New Delivery Address"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  required
                  defaultValue={editingAddress?.fullName || ""}
                  placeholder="e.g. Ramesh Chandra"
                  className="w-full h-9 px-3 rounded border border-border-base text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Address Line 1 (House/Shop No, Street) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="addressLine1"
                  required
                  defaultValue={editingAddress?.addressLine1 || ""}
                  placeholder="e.g. Shop #4, Main Market, Suriyawan Road"
                  className="w-full h-9 px-3 rounded border border-border-base text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Address Line 2 (Area, Landmark)
                </label>
                <input
                  type="text"
                  name="addressLine2"
                  defaultValue={editingAddress?.addressLine2 || ""}
                  placeholder="e.g. Near Railway Crossing"
                  className="w-full h-9 px-3 rounded border border-border-base text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    required
                    defaultValue={editingAddress?.city || "Suriyawan"}
                    className="w-full h-9 px-3 rounded border border-border-base text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="state"
                    required
                    defaultValue={editingAddress?.state || "Uttar Pradesh"}
                    className="w-full h-9 px-3 rounded border border-border-base text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Pincode (6 digits) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    required
                    maxLength={6}
                    defaultValue={editingAddress?.pincode || "221404"}
                    className="w-full h-9 px-3 font-mono rounded border border-border-base text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="alternatePhone"
                    defaultValue={editingAddress?.alternatePhone || ""}
                    placeholder="10-digit mobile"
                    className="w-full h-9 px-3 font-mono rounded border border-border-base text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange-600"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="isDefault"
                    value="true"
                    defaultChecked={editingAddress ? editingAddress.isDefault : addresses.length === 0}
                    className="w-4 h-4 rounded text-brand-orange-600 focus:ring-brand-orange-600"
                  />
                  <span className="text-xs text-slate-700">Set as my default delivery address</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-base">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-9 px-4 rounded border border-border-base text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-9 px-5 rounded bg-brand-orange-600 hover:bg-brand-orange-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isPending && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingAddress ? "Save Changes" : "Add Address"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
