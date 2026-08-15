"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Zap, Check, AlertCircle, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { addToCart, checkPincode } from "@/app/(store)/actions";
import PriceDisplay from "./PriceDisplay";
import QuantityStepper from "./QuantityStepper";

export type BuyBoxVariant = {
  id: string;
  title: string;
  price: number | null;
  stock: number;
  isAvailable: boolean;
};

export default function ProductBuyBox({
  productId,
  basePrice,
  variants,
  stockMode,
  isAvailable,
}: {
  productId: string;
  basePrice: number;
  variants: BuyBoxVariant[];
  stockMode: string;
  isAvailable: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [pincode, setPincode] = useState("");
  const [delivery, setDelivery] = useState<{ ok: boolean; message: string } | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = variants.find((v) => v.id === selectedId);
  const price = selected?.price ?? basePrice;
  const tracked = stockMode === "TRACKED";
  const maxQty = tracked && selected ? Math.max(1, selected.stock) : 99;
  const soldOut = !isAvailable || (tracked && selected ? selected.stock <= 0 : false);

  function handleAdd(thenCheckout: boolean) {
    setFeedback(null);
    startTransition(async () => {
      const result = await addToCart({
        productId,
        variantId: selectedId ?? undefined,
        quantity,
      });
      if (!result.ok) {
        setFeedback({ ok: false, message: result.error });
        return;
      }
      if (thenCheckout) {
        router.push("/cart");
      } else {
        setFeedback({ ok: true, message: "Added to your cart." });
        router.refresh();
      }
    });
  }

  function handlePincode() {
    startTransition(async () => {
      const result = await checkPincode(pincode);
      setDelivery(
        result.ok
          ? { ok: true, message: `Deliverable — ships in ${result.etaDays}` }
          : { ok: false, message: result.error }
      );
    });
  }

  const actions = (
    <>
      <button
        onClick={() => handleAdd(false)}
        disabled={isPending || soldOut}
        className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-md border-2 border-brand-orange-600 text-brand-orange-600 text-sm font-bold uppercase tracking-wide hover:bg-brand-orange-50 disabled:opacity-50 transition-colors"
      >
        <ShoppingCart size={17} />
        Add to Cart
      </button>
      <button
        onClick={() => handleAdd(true)}
        disabled={isPending || soldOut}
        className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-md bg-brand-orange-600 text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        <Zap size={17} fill="currentColor" />
        Buy Now
      </button>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border-base rounded-lg p-5">
        <PriceDisplay
          price={price}
          size="display"
          note="Inclusive of all taxes · GST invoice available"
        />
      </div>

      {variants.length > 1 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
            Select Variant
          </h3>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const disabled = !v.isAvailable || (tracked && v.stock <= 0);
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelectedId(v.id);
                    setQuantity(1);
                  }}
                  disabled={disabled}
                  className={cn(
                    "min-h-[44px] px-4 rounded-md border text-sm font-medium transition-colors",
                    v.id === selectedId
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "bg-surface border-border-base text-slate-900 hover:border-slate-400",
                    disabled && "opacity-40 line-through cursor-not-allowed"
                  )}
                >
                  {v.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Quantity</h3>
        <QuantityStepper value={quantity} onChange={setQuantity} max={maxQty} disabled={soldOut} />
        {tracked && selected && selected.stock > 0 && selected.stock <= 5 && (
          <p className="text-xs text-danger font-medium mt-2">
            Only {selected.stock} left in stock
          </p>
        )}
      </div>

      {/* Delivery check */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
          Delivery Check
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pincode}
            onChange={(e) => {
              setPincode(e.target.value.replace(/\D/g, ""));
              setDelivery(null);
            }}
            placeholder="Enter pincode"
            className="flex-1 min-h-[44px] px-3 bg-surface border border-border-base rounded-md text-sm text-slate-900 placeholder-muted focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <button
            onClick={handlePincode}
            disabled={isPending || pincode.length !== 6}
            className="min-h-[44px] px-5 rounded-md text-sm font-bold uppercase tracking-wide text-brand-orange-600 hover:bg-brand-orange-50 disabled:opacity-40 transition-colors"
          >
            Check
          </button>
        </div>
        {delivery && (
          <p
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium mt-2",
              delivery.ok ? "text-success" : "text-danger"
            )}
          >
            {delivery.ok ? <Truck size={14} /> : <AlertCircle size={14} />}
            {delivery.message}
          </p>
        )}
      </div>

      {feedback && (
        <p
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            feedback.ok ? "text-success" : "text-danger"
          )}
          role="status"
        >
          {feedback.ok ? <Check size={16} /> : <AlertCircle size={16} />}
          {feedback.message}
        </p>
      )}

      {soldOut && (
        <p className="text-sm font-semibold text-danger">
          This item is currently out of stock.
        </p>
      )}

      {/* Desktop actions */}
      <div className="hidden lg:flex gap-3">{actions}</div>

      {/* Mobile sticky action bar, sitting above the bottom nav */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 flex gap-3 p-3 bg-surface border-t border-border-base shadow-lg">
        {actions}
      </div>
    </div>
  );
}
