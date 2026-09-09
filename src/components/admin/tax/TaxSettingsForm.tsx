"use client";

import React, { useState } from "react";
import {
  Settings,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Percent,
  CheckCircle2,
  Lock,
} from "lucide-react";
import {
  PageHeader,
  SearchableSelect,
  SelectOption,
  ConfirmDialog,
  Modal,
  useToast,
} from "@/components/admin/ui";
import { INDIAN_STATES, validateGSTIN } from "@/lib/tax/indian-states";
import { updateTaxSettingsAction } from "@/app/admin/(authenticated)/tax/actions";

interface TaxSettingsData {
  id: string;
  sellerStateCode: string;
  sellerGstin: string;
  pricingMode: "EXCLUSIVE" | "INCLUSIVE" | string;
  defaultHsnId?: string | null;
  defaultHsn?: {
    id: string;
    code: string;
    description: string;
    rateType: string;
  } | null;
  productCount: number;
  isSuperAdmin: boolean;
}

export default function TaxSettingsForm({
  initialSettings,
  hsns,
}: {
  initialSettings: TaxSettingsData;
  hsns: Array<{ id: string; code: string; description: string }>;
}) {
  const [gstin, setGstin] = useState(initialSettings.sellerGstin || "");
  const [stateCode, setStateCode] = useState(initialSettings.sellerStateCode || "27");
  const [pricingMode, setPricingMode] = useState<"EXCLUSIVE" | "INCLUSIVE">(
    (initialSettings.pricingMode as any) || "EXCLUSIVE"
  );
  const [defaultHsnId, setDefaultHsnId] = useState<string>(
    initialSettings.defaultHsnId || ""
  );

  const [gstinError, setGstinError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Heavy Gate Switch Confirmation Modal
  const [pendingPricingMode, setPendingPricingMode] = useState<"EXCLUSIVE" | "INCLUSIVE" | null>(
    null
  );
  const [switchConfirmationText, setSwitchConfirmationText] = useState("");
  const [isSwitchDialogOpen, setIsSwitchDialogOpen] = useState(false);

  const toast = useToast();
  const isReadOnly = !initialSettings.isSuperAdmin;

  const hsnOptions: SelectOption[] = hsns.map((h) => ({
    value: h.id,
    label: `${h.code} — ${h.description}`,
  }));

  // GSTIN change handler
  function handleGstinChange(val: string) {
    const formatted = val.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);
    setGstin(formatted);

    // Auto-sync state code if first 2 chars match an Indian state
    if (formatted.length >= 2) {
      const code = formatted.slice(0, 2);
      const matched = INDIAN_STATES.find((s) => s.code === code);
      if (matched) {
        setStateCode(code);
      }
    }

    if (formatted.length === 15) {
      const check = validateGSTIN(formatted);
      setGstinError(check.isValid ? null : check.error || "Invalid GSTIN");
    } else {
      setGstinError(null);
    }
  }

  function handlePricingModeChange(newMode: "EXCLUSIVE" | "INCLUSIVE") {
    if (isReadOnly) return;
    if (newMode === initialSettings.pricingMode) {
      setPricingMode(newMode);
      return;
    }

    // Heavy gate dialog if products exist (TAX-05)
    if (initialSettings.productCount > 0) {
      setPendingPricingMode(newMode);
      setSwitchConfirmationText("");
      setIsSwitchDialogOpen(true);
    } else {
      setPricingMode(newMode);
    }
  }

  function handleConfirmSwitch() {
    if (switchConfirmationText.trim() !== "SWITCH" || !pendingPricingMode) return;
    setPricingMode(pendingPricingMode);
    setIsSwitchDialogOpen(false);
    setPendingPricingMode(null);
    setSwitchConfirmationText("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnly) return;

    const check = validateGSTIN(gstin);
    if (!check.isValid) {
      setGstinError(check.error || "Invalid GSTIN");
      return;
    }
    setGstinError(null);

    setIsSaving(true);
    try {
      const res = await updateTaxSettingsAction({
        sellerGstin: gstin.trim().toUpperCase(),
        sellerStateCode: stateCode,
        pricingMode,
        defaultHsnId: defaultHsnId || null,
        confirmationToken: pricingMode !== initialSettings.pricingMode ? "SWITCH" : undefined,
      });

      if (!res.ok) {
        if (res.needsSwitchConfirmation) {
          setIsSwitchDialogOpen(true);
          setPendingPricingMode(pricingMode);
        } else {
          toast.error("Save Failed", res.error);
        }
        return;
      }

      toast.success(
        "Tax Settings Saved",
        "Seller identity and pricing rules updated successfully."
      );
      window.location.reload();
    } catch (err: any) {
      toast.error("Save Failed", err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Tax Settings"
        subtitle="Business tax identity, origin state, and platform-wide pricing convention"
      />

      {/* Read-Only Banner for Finance Role */}
      {isReadOnly && (
        <div className="p-3.5 bg-[var(--gray-100)] border-l-4 border-[var(--gray-400)] text-[var(--gray-800)] rounded-r-[var(--radius-md)] flex items-center gap-2.5">
          <Lock size={16} className="text-[var(--gray-600)] flex-shrink-0" />
          <span className="text-[var(--text-sm)] font-medium">
            Only the account owner (Super Admin) can change tax settings. You have read-only access.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: Seller Identity */}
        <div className="bg-[var(--color-surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--gray-200)] shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--gray-200)] pb-3">
            <Building2 size={18} className="text-[var(--blue-600)]" />
            <h2 className="text-[var(--text-base)] font-bold text-[var(--gray-900)]">
              Seller Identity & Registration
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* GSTIN */}
            <div>
              <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
                Seller GSTIN <span className="text-[var(--red-500)]">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isReadOnly}
                maxLength={15}
                value={gstin}
                onChange={(e) => handleGstinChange(e.target.value)}
                placeholder="27AABCV1234K1Z5"
                className={`w-full px-3 py-2 font-mono text-[var(--text-sm)] border rounded-[var(--radius-md)] uppercase focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)] ${
                  gstinError
                    ? "border-[var(--red-500)] bg-[var(--red-50)]/30 text-[var(--red-900)]"
                    : "border-[var(--gray-300)]"
                } disabled:bg-[var(--gray-100)] disabled:text-[var(--gray-600)]`}
              />
              {gstinError ? (
                <p className="text-[11px] text-[var(--red-600)] font-medium mt-1">
                  {gstinError}
                </p>
              ) : (
                <p className="text-[11px] text-[var(--gray-500)] mt-1">
                  15-character GST identification number (State + PAN + Entity + Z + Checksum)
                </p>
              )}
            </div>

            {/* Registered State */}
            <div>
              <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
                Registered Origin State <span className="text-[var(--red-500)]">*</span>
              </label>
              <select
                disabled={isReadOnly}
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="w-full px-3 py-2 text-[var(--text-sm)] bg-white border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)] disabled:bg-[var(--gray-100)] disabled:text-[var(--gray-600)]"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[var(--gray-500)] mt-1">
                Deliveries inside this state are taxed as CGST + SGST. Deliveries outside are IGST.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: Pricing Mode */}
        <div className="bg-[var(--color-surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--gray-200)] shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--gray-200)] pb-3">
            <Percent size={18} className="text-[var(--blue-600)]" />
            <h2 className="text-[var(--text-base)] font-bold text-[var(--gray-900)]">
              Pricing Mode
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <label
              className={`p-4 border rounded-[var(--radius-lg)] cursor-pointer flex flex-col gap-1.5 transition-all ${
                pricingMode === "EXCLUSIVE"
                  ? "bg-white border-[var(--blue-600)] ring-1 ring-[var(--blue-600)] shadow-sm"
                  : "bg-[var(--gray-50)] border-[var(--gray-200)] hover:bg-white"
              } ${isReadOnly ? "cursor-not-allowed opacity-80" : ""}`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pricingMode"
                  disabled={isReadOnly}
                  checked={pricingMode === "EXCLUSIVE"}
                  onChange={() => handlePricingModeChange("EXCLUSIVE")}
                  className="text-[var(--blue-600)] focus:ring-[var(--blue-500)]"
                />
                <span className="text-[var(--text-sm)] font-bold text-[var(--gray-900)]">
                  Tax-exclusive (Default)
                </span>
              </div>
              <p className="text-[var(--text-xs)] text-[var(--gray-600)] ml-5 leading-relaxed">
                Product prices exclude GST. Tax is added at checkout on top of the product price.
              </p>
            </label>

            <label
              className={`p-4 border rounded-[var(--radius-lg)] cursor-pointer flex flex-col gap-1.5 transition-all ${
                pricingMode === "INCLUSIVE"
                  ? "bg-white border-[var(--blue-600)] ring-1 ring-[var(--blue-600)] shadow-sm"
                  : "bg-[var(--gray-50)] border-[var(--gray-200)] hover:bg-white"
              } ${isReadOnly ? "cursor-not-allowed opacity-80" : ""}`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pricingMode"
                  disabled={isReadOnly}
                  checked={pricingMode === "INCLUSIVE"}
                  onChange={() => handlePricingModeChange("INCLUSIVE")}
                  className="text-[var(--blue-600)] focus:ring-[var(--blue-500)]"
                />
                <span className="text-[var(--text-sm)] font-bold text-[var(--gray-900)]">
                  Tax-inclusive
                </span>
              </div>
              <p className="text-[var(--text-xs)] text-[var(--gray-600)] ml-5 leading-relaxed">
                Product prices include GST. Tax is calculated as a breakdown of the price, not added to it.
              </p>
            </label>
          </div>
        </div>

        {/* SECTION 3: Default Fallback HSN */}
        <div className="bg-[var(--color-surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--gray-200)] shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--gray-200)] pb-3">
            <ShieldCheck size={18} className="text-[var(--blue-600)]" />
            <h2 className="text-[var(--text-base)] font-bold text-[var(--gray-900)]">
              Fallback Classification
            </h2>
          </div>

          <div>
            <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1.5">
              Default HSN Code (Fallback)
            </label>
            <div className="max-w-md">
              <SearchableSelect
                options={hsnOptions}
                value={defaultHsnId}
                onChange={(val) => !isReadOnly && setDefaultHsnId(val as string)}
                placeholder="Select fallback HSN code..."
                disabled={isReadOnly}
              />
            </div>
            <p className="text-[11px] text-[var(--gray-500)] mt-1.5">
              Used as a fallback when a category has no mapping. Products will still warn in the catalog that they need a proper classification.
            </p>
          </div>
        </div>

        {/* Action Button */}
        {!isReadOnly && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 text-[var(--text-sm)] font-bold text-white bg-[var(--blue-600)] hover:bg-[var(--blue-700)] rounded-[var(--radius-md)] shadow-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Tax Settings"}
            </button>
          </div>
        )}
      </form>

      {/* Heavy Gate Confirmation Dialog (TAX-05) */}
      <Modal
        isOpen={isSwitchDialogOpen}
        onClose={() => {
          setIsSwitchDialogOpen(false);
          setPendingPricingMode(null);
          setSwitchConfirmationText("");
        }}
        title="Confirm Pricing Mode Switch"
        className="max-w-[480px]"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3.5 bg-[var(--amber-50)] border-l-4 border-[var(--amber-500)] text-[var(--amber-900)] rounded-r-[var(--radius-md)] space-y-2 text-[var(--text-sm)]">
            <div className="flex items-center gap-2 font-bold text-[var(--amber-900)]">
              <AlertTriangle size={18} className="text-[var(--amber-600)]" />
              Revenue-wide Consequence Warning
            </div>
            <p className="leading-relaxed">
              Switching to{" "}
              <span className="font-bold">
                {pendingPricingMode === "INCLUSIVE" ? "tax-inclusive" : "tax-exclusive"}
              </span>{" "}
              changes what every one of your{" "}
              <span className="font-bold text-[var(--gray-900)]">
                {initialSettings.productCount}
              </span>{" "}
              products charges the customer. Existing orders are unaffected.
            </p>
          </div>

          <div>
            <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
              Type <span className="font-mono text-[var(--red-600)]">SWITCH</span> to confirm:
            </label>
            <input
              type="text"
              value={switchConfirmationText}
              onChange={(e) => setSwitchConfirmationText(e.target.value)}
              placeholder="SWITCH"
              className="w-full px-3 py-2 font-mono text-[var(--text-sm)] border border-[var(--gray-300)] rounded-[var(--radius-md)] uppercase focus:outline-none focus:ring-2 focus:ring-[var(--amber-500)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--gray-200)]">
            <button
              type="button"
              onClick={() => {
                setIsSwitchDialogOpen(false);
                setPendingPricingMode(null);
                setSwitchConfirmationText("");
              }}
              className="px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--gray-700)] hover:bg-[var(--gray-100)] rounded-[var(--radius-md)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={switchConfirmationText.trim() !== "SWITCH"}
              onClick={handleConfirmSwitch}
              className="px-4 py-2 text-[var(--text-sm)] font-bold text-white bg-[var(--amber-600)] hover:bg-[var(--amber-700)] rounded-[var(--radius-md)] disabled:opacity-50 transition-colors"
            >
              Confirm Switch
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
