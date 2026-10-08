"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Zap,
  Check,
  AlertCircle,
  Truck,
  MessageCircle,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { cn, formatINR, ownerWhatsAppUrl } from "@/lib/utils";
import { addToCart, checkPincode } from "@/app/(store)/actions";
import QuantityStepper from "./QuantityStepper";

export type BuyBoxAttributeValue = {
  id: string;
  label: string;
  code: string;
  swatchHex?: string | null;
  attribute: {
    id: string;
    name: string;
    code: string;
    helpText?: string | null;
    usesSwatches?: boolean;
  };
};

export type BuyBoxVariant = {
  id: string;
  title: string;
  sku: string;
  price: number | null;
  mrp: number | null;
  stock: number;
  isAvailable: boolean;
  variantAttributeValues?: {
    attribute: {
      id: string;
      name: string;
      code: string;
      helpText?: string | null;
      usesSwatches?: boolean;
    };
    attributeValue: {
      id: string;
      label: string;
      code: string;
      swatchHex?: string | null;
    };
  }[];
};

interface ProductBuyBoxProps {
  productId: string;
  productTitle: string;
  basePrice: number;
  baseMrp?: number | null;
  variants: BuyBoxVariant[];
  stockMode: string;
  isAvailable: boolean;
  sourcingLeadDays?: number | null;
}

export default function ProductBuyBox({
  productId,
  productTitle,
  basePrice,
  baseMrp,
  variants,
  stockMode,
  isAvailable,
  sourcingLeadDays = 5,
}: ProductBuyBoxProps) {
  const router = useRouter();

  // ── GROUP VARIANTS BY ATTRIBUTE (§5.3) ──────────────────────────────────
  // Decompose variant combinations into discrete attribute groups
  const attributeGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        name: string;
        code: string;
        helpText?: string | null;
        usesSwatches: boolean;
        options: { label: string; code: string; swatchHex?: string | null }[];
      }
    > = {};

    // Check if variants have DB relations
    let hasDbRelations = false;
    for (const v of variants) {
      if (v.variantAttributeValues && v.variantAttributeValues.length > 0) {
        hasDbRelations = true;
        for (const vav of v.variantAttributeValues) {
          const attr = vav.attribute;
          const val = vav.attributeValue;
          if (!groups[attr.code]) {
            groups[attr.code] = {
              name: attr.name,
              code: attr.code,
              helpText: attr.helpText,
              usesSwatches: Boolean(attr.usesSwatches),
              options: [],
            };
          }
          if (!groups[attr.code].options.some((o) => o.code === val.code)) {
            groups[attr.code].options.push({
              label: val.label,
              code: val.code,
              swatchHex: val.swatchHex,
            });
          }
        }
      }
    }

    // Fallback: Parse titles if slash-separated (e.g. "1200 mm / Pearl White")
    if (!hasDbRelations && variants.length > 1) {
      const partsList = variants.map((v) => v.title.split("/").map((p) => p.trim()));
      const numAttributes = partsList[0]?.length || 1;

      if (numAttributes >= 2) {
        // Assume Part 0 is Size/Gauge/Capacity, Part 1 is Colour
        groups["attr_0"] = {
          name: "Size / Specification",
          code: "attr_0",
          helpText: "Select your desired physical dimensions or rating.",
          usesSwatches: false,
          options: [],
        };
        groups["attr_1"] = {
          name: "Colour / Finish",
          code: "attr_1",
          helpText: "Matte finishes resist dust; gloss finishes wipe clean easily.",
          usesSwatches: true,
          options: [],
        };

        for (const parts of partsList) {
          if (parts[0] && !groups["attr_0"].options.some((o) => o.label === parts[0])) {
            groups["attr_0"].options.push({ label: parts[0], code: parts[0].toLowerCase().replace(/\s+/g, "_") });
          }
          if (parts[1] && !groups["attr_1"].options.some((o) => o.label === parts[1])) {
            let swatchHex = "#FFFFFF";
            const lower = parts[1].toLowerCase();
            if (lower.includes("white")) swatchHex = "#FFFFFF";
            else if (lower.includes("brown") || lower.includes("bronze")) swatchHex = "#4E3629";
            else if (lower.includes("black")) swatchHex = "#1F2428";
            else if (lower.includes("red")) swatchHex = "#C2185B";
            else if (lower.includes("green")) swatchHex = "#1F6B52";
            else if (lower.includes("blue") || lower.includes("cyan")) swatchHex = "#1C3140";
            else if (lower.includes("ivory") || lower.includes("gold")) swatchHex = "#EFEBD9";

            groups["attr_1"].options.push({
              label: parts[1],
              code: parts[1].toLowerCase().replace(/\s+/g, "_"),
              swatchHex,
            });
          }
        }
      }
    }

    return Object.values(groups);
  }, [variants]);

  // Selected state per attribute group
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const group of attributeGroups) {
      if (group.options[0]) {
        init[group.code] = group.options[0].label;
      }
    }
    return init;
  });

  // Resolve matching variant from choices
  const currentVariant = useMemo(() => {
    if (variants.length <= 1) return variants[0] || null;

    if (attributeGroups.length > 0) {
      // Find variant whose title or DB attributes match all selected choices
      const match = variants.find((v) => {
        // If DB relations present
        if (v.variantAttributeValues && v.variantAttributeValues.length > 0) {
          return Object.entries(selectedChoices).every(([attrCode, label]) => {
            return v.variantAttributeValues?.some(
              (vav) => vav.attribute.code === attrCode && vav.attributeValue.label === label
            );
          });
        }

        // Title match
        return Object.values(selectedChoices).every((choiceLabel) =>
          v.title.toLowerCase().includes(choiceLabel.toLowerCase())
        );
      });

      if (match) return match;
    }

    return variants[0] || null;
  }, [variants, attributeGroups, selectedChoices]);

  // Pricing calculations
  const price = currentVariant?.price ?? basePrice;
  const mrp = currentVariant?.mrp ?? baseMrp ?? null;
  const hasDiscount = mrp != null && mrp > price;
  const savings = hasDiscount ? mrp - price : 0;
  const discountPct = hasDiscount ? Math.round((savings / mrp) * 100) : 0;

  // Stock calculations
  const tracked = stockMode === "TRACKED";
  const stockQty = currentVariant?.stock ?? 0;
  const isOutOfStock = !isAvailable || (tracked && stockQty <= 0);
  const isLowStock = tracked && stockQty > 0 && stockQty <= 3;

  // Quantity stepper
  const [quantity, setQuantity] = useState(1);
  const maxAllowedQty = tracked && currentVariant ? Math.max(1, currentVariant.stock) : 99;

  // Pincode ETA
  const [pincode, setPincode] = useState("");
  const [deliveryResult, setDeliveryResult] = useState<{
    ok: boolean;
    eta?: string;
    cod?: boolean;
    freeShipping?: boolean;
    message: string;
  } | null>(null);

  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelectChoice(groupCode: string, optionLabel: string) {
    setSelectedChoices((prev) => ({
      ...prev,
      [groupCode]: optionLabel,
    }));
  }

  function handleAdd(thenCheckout: boolean) {
    setFeedback(null);
    startTransition(async () => {
      const result = await addToCart({
        productId,
        variantId: currentVariant?.id ?? undefined,
        quantity,
      });

      if (!result.ok) {
        setFeedback({ ok: false, message: result.error });
        return;
      }

      if (thenCheckout) {
        router.push("/cart");
      } else {
        setFeedback({ ok: true, message: "Added to your order." });
        router.refresh();
      }
    });
  }

  function handlePincodeCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pincode.trim())) {
      setDeliveryResult({ ok: false, message: "Enter a valid 6-digit Indian PIN code." });
      return;
    }

    startTransition(async () => {
      const result = await checkPincode(pincode.trim());
      if (result.ok) {
        const today = new Date();
        const days = result.etaDays || 3;
        const etaDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
        const dateStr = etaDate.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });

        setDeliveryResult({
          ok: true,
          eta: dateStr,
          cod: result.codAvailable !== false,
          freeShipping: price >= 999,
          message: `Reaches your address by ${dateStr}. Cash on delivery supported.`,
        });
      } else {
        setDeliveryResult({
          ok: false,
          message: result.error || "Pincode is currently unserviceable for direct delivery.",
        });
      }
    });
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-6 space-y-6">
      {/* ── Price Block (§6.3) ─────────────────────────────────────────── */}
      <div className="border-b border-[var(--line-soft)] pb-5">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-extrabold text-[var(--fg)] fig tracking-tight">
            ₹{formatINR(price)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-lg text-[var(--fg-quiet)] line-through fig">
                ₹{formatINR(mrp)}
              </span>
              <span className="flag flag-ok font-bold text-xs">
                {discountPct}% OFF
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--fg-muted)]">
          <span className="font-semibold text-[var(--ok)]">
            {hasDiscount ? `You save ₹${formatINR(savings)}` : "Direct distributor price"}
          </span>
          <span>·</span>
          <span>Price includes 18% GST (Tax invoice provided)</span>
        </div>
      </div>

      {/* ── Grouped Variant Option Selectors (§5.3) ───────────────────── */}
      {attributeGroups.length > 0 ? (
        <div className="space-y-5">
          {attributeGroups.map((group) => {
            const currentChoice = selectedChoices[group.code];
            return (
              <div key={group.code} className="var-group">
                <div className="var-label">
                  <b>{group.name}</b>
                  <span>Selected: <strong className="text-[var(--fg)]">{currentChoice}</strong></span>
                </div>

                <div className="var-chips">
                  {group.options.map((opt) => {
                    const isSelected = currentChoice === opt.label;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => handleSelectChoice(group.code, opt.label)}
                        className={cn(
                          "var-chip",
                          isSelected && "is-selected"
                        )}
                        aria-pressed={isSelected}
                      >
                        {group.usesSwatches && opt.swatchHex && (
                          <span
                            className="swatch-dot"
                            style={{ backgroundColor: opt.swatchHex }}
                            aria-hidden="true"
                          />
                        )}
                        <span>{opt.label}</span>
                        {isSelected && <Check size={14} className="text-[var(--accent)]" />}
                      </button>
                    );
                  })}
                </div>

                {group.helpText && (
                  <p className="var-helper">{group.helpText}</p>
                )}
              </div>
            );
          })}
        </div>
      ) : variants.length > 1 ? (
        /* Flat fallback if only title variations */
        <div className="var-group">
          <div className="var-label">
            <b>Available Variants</b>
            <span>{currentVariant?.title}</span>
          </div>
          <div className="var-chips">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedChoices({ default: v.title })}
                className={cn("var-chip", currentVariant?.id === v.id && "is-selected")}
              >
                <span>{v.title}</span>
                {currentVariant?.id === v.id && <Check size={14} className="text-[var(--accent)]" />}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Honest Availability Badge (§5.3 & Principle P-05) ───────────── */}
      <div className="p-3.5 rounded bg-[var(--mortar)] border border-[var(--line)] text-sm flex items-center gap-3">
        {isOutOfStock ? (
          <>
            <Clock size={18} className="text-[var(--ask)] flex-shrink-0" />
            <div>
              <span className="font-bold text-[var(--ask)] block">
                Arranged in {sourcingLeadDays || 5}–{(sourcingLeadDays || 5) + 2} days
              </span>
              <span className="text-xs text-[var(--fg-muted)]">
                Direct factory restock scheduled from authorised hub.
              </span>
            </div>
          </>
        ) : isLowStock ? (
          <>
            <AlertCircle size={18} className="text-[var(--signal-700)] flex-shrink-0" />
            <div>
              <span className="font-bold text-[var(--signal-700)] block">
                Last {stockQty} units remaining in Suriyawan depot
              </span>
              <span className="text-xs text-[var(--fg-muted)]">
                Dispatches today on confirmed orders.
              </span>
            </div>
          </>
        ) : (
          <>
            <Check size={18} className="text-[var(--ok)] flex-shrink-0" />
            <div>
              <span className="font-bold text-[var(--ok)] block">
                In stock · Dispatches in 24–48 hours
              </span>
              <span className="text-xs text-[var(--fg-muted)]">
                Local stock verified ready for courier pickup or counter collection.
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Quantity Stepper & Order Controls ───────────────────────────── */}
      <div className="flex items-center gap-4 pt-2">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
          Quantity:
        </label>
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          min={1}
          max={isOutOfStock ? 1 : maxAllowedQty}
        />
        {tracked && stockQty > 0 && stockQty <= 5 && (
          <span className="text-xs font-semibold text-[var(--signal-700)]">
            Only {stockQty} left
          </span>
        )}
      </div>

      {/* ── Pin Code Serviceability Check (§6.3) ────────────────────────── */}
      <div className="pt-2 border-t border-[var(--line-soft)]">
        <form onSubmit={handlePincodeCheck} className="fld">
          <label htmlFor="pincode-check" className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            Check Delivery Date & COD Availability
          </label>
          <div className="flex gap-2">
            <input
              id="pincode-check"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Enter 6-digit Pincode (e.g. 221404)"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
              className="inp text-sm font-mono flex-1"
            />
            <button
              type="submit"
              disabled={isPending || pincode.length !== 6}
              className="act act-ink min-h-[48px] px-5 text-sm"
            >
              Check
            </button>
          </div>
        </form>

        {deliveryResult && (
          <div
            className={cn(
              "mt-3 p-3 rounded text-xs flex items-start gap-2.5",
              deliveryResult.ok
                ? "bg-[var(--verdigris-wash)] text-[var(--verdigris-700)] border border-[var(--verdigris-700)]/20"
                : "bg-red-50 text-[var(--signal-700)] border border-red-200"
            )}
          >
            {deliveryResult.ok ? <Truck size={16} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />}
            <div>
              <p className="font-semibold">{deliveryResult.message}</p>
              {deliveryResult.freeShipping && (
                <p className="mt-0.5 text-[var(--verdigris-700)] font-bold">✓ Qualifies for FREE surface shipping!</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop Inline Action Buttons (§6.3) ────────────────────────── */}
      <div className="pt-2 space-y-3 d-only flex-col">
        <div className="flex gap-3 w-full">
          <button
            onClick={() => handleAdd(false)}
            disabled={isPending}
            className="act act-line flex-1 act-big"
          >
            <ShoppingCart size={18} />
            <span>Add to Cart</span>
          </button>
          <button
            onClick={() => handleAdd(true)}
            disabled={isPending}
            className="act act-fill flex-1 act-big"
          >
            <Zap size={18} className="fill-white" />
            <span>Buy Now</span>
          </button>
        </div>

        {feedback && (
          <p
            className={cn(
              "text-xs font-semibold text-center",
              feedback.ok ? "text-[var(--ok)]" : "text-[var(--signal-700)]"
            )}
          >
            {feedback.message}
          </p>
        )}
      </div>

      {/* ── Mobile Sticky Buy Bar (§6.3) ────────────────────────────────── */}
      <div className="sticky-buy-bar">
        <div className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold text-[var(--fg)] fig leading-tight">
            ₹{formatINR(price)}
          </span>
          <span className="block text-xs text-[var(--fg-muted)] truncate">
            {currentVariant?.title || productTitle}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAdd(false)}
            disabled={isPending}
            className="act act-line px-3 text-xs"
          >
            <ShoppingCart size={16} />
            <span>Add</span>
          </button>
          <button
            onClick={() => handleAdd(true)}
            disabled={isPending}
            className="act act-fill px-4 text-xs"
          >
            <Zap size={16} className="fill-white" />
            <span>Buy Now</span>
          </button>
        </div>
      </div>

      {/* ── Consultation Strip (§6.3) ──────────────────────────────────── */}
      <div className="p-3.5 rounded bg-[var(--mortar)] border border-[var(--line-soft)] flex items-center justify-between gap-3 text-xs">
        <div className="min-w-0">
          <b className="text-[var(--fg)] block">Not sure which size fits?</b>
          <span className="text-[var(--fg-muted)] block truncate">
            Ask our Suriyawan trade team directly on WhatsApp.
          </span>
        </div>
        <a
          href={ownerWhatsAppUrl(`Hello Vaishnavi Enterprises, I have a question about ${productTitle} (${currentVariant?.sku || ""}).`)}
          target="_blank"
          rel="noopener noreferrer"
          className="act act-chat px-3 min-h-[38px] text-xs flex-shrink-0"
        >
          <MessageCircle size={14} />
          <span>Ask</span>
        </a>
      </div>
    </div>
  );
}
