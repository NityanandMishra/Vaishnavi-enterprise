"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatPaise, parsePaise } from "@/lib/money";

interface CurrencyInputProps {
  id?: string;
  name?: string;
  valuePaise: number | null | undefined;
  onChangePaise: (paise: number) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  hasError?: boolean;
  minPaise?: number;
  maxPaise?: number;
  className?: string;
  "aria-describedby"?: string;
}

export default function CurrencyInput({
  id,
  name,
  valuePaise,
  onChangePaise,
  placeholder = "0.00",
  disabled = false,
  required = false,
  hasError = false,
  minPaise,
  maxPaise,
  className,
  "aria-describedby": ariaDescribedBy,
}: CurrencyInputProps) {
  // Local display text (allows active typing without premature formatting)
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (valuePaise === null || valuePaise === undefined) return "";
    return (valuePaise / 100).toFixed(2).replace(/\.00$/, "");
  });

  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      if (valuePaise === null || valuePaise === undefined || isNaN(valuePaise)) {
        setDisplayValue("");
      } else {
        const rupees = valuePaise / 100;
        setDisplayValue(rupees.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
      }
    }
  }, [valuePaise, isFocused]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow digits, single decimal point
    const sanitized = raw.replace(/[^0-9.]/g, "");
    setDisplayValue(sanitized);

    const parsed = parsePaise(sanitized);
    onChangePaise(parsed);
  }

  function handleBlur() {
    setIsFocused(false);
    const parsed = parsePaise(displayValue);
    let clamped = parsed;
    if (minPaise !== undefined && clamped < minPaise) clamped = minPaise;
    if (maxPaise !== undefined && clamped > maxPaise) clamped = maxPaise;

    if (clamped !== parsed) {
      onChangePaise(clamped);
    }

    const rupees = clamped / 100;
    setDisplayValue(rupees.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
  }

  function handleFocus() {
    setIsFocused(true);
    if (valuePaise !== null && valuePaise !== undefined && valuePaise > 0) {
      setDisplayValue((valuePaise / 100).toString());
    }
  }

  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <span
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)] font-mono text-[var(--text-sm)] font-medium pointer-events-none select-none"
        aria-hidden="true"
      >
        ₹
      </span>
      <input
        type="text"
        inputMode="decimal"
        id={id}
        name={name}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        aria-invalid={hasError}
        aria-describedby={ariaDescribedBy}
        className={cn(
          "w-full h-[var(--input-height)] pl-7 pr-3 text-right font-mono text-[var(--text-sm)] font-medium rounded-[var(--input-radius)] bg-[var(--input-bg)] border transition-colors focus:outline-none",
          hasError
            ? "border-[var(--input-border-error)] focus:ring-1 focus:ring-[var(--input-border-error)]"
            : "border-[var(--input-border)] focus:border-[var(--input-border-focus)] focus:ring-1 focus:ring-[var(--input-border-focus)]",
          disabled && "opacity-50 cursor-not-allowed bg-[var(--color-surface-sunken)]"
        )}
      />
    </div>
  );
}
