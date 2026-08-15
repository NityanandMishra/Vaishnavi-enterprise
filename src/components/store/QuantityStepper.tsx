"use client";

import { Minus, Plus } from "lucide-react";

export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-stretch border border-border-base rounded-md overflow-hidden bg-surface">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        className="w-11 h-11 flex items-center justify-center text-slate-900 hover:bg-surface-alt disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
      >
        <Minus size={16} />
      </button>
      <span
        aria-live="polite"
        className="w-12 flex items-center justify-center text-sm font-bold text-slate-900 border-x border-border-base"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
        className="w-11 h-11 flex items-center justify-center text-slate-900 hover:bg-surface-alt disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
