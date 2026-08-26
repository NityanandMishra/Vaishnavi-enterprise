"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  isCustom?: boolean;
}

interface SearchableSelectProps {
  id?: string;
  options: SelectOption[];
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allowCreate?: boolean;
  onCreateNew?: (query: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  "aria-describedby"?: string;
}

export default function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select an option…",
  searchPlaceholder = "Search…",
  allowCreate = false,
  onCreateNew,
  disabled = false,
  hasError = false,
  className,
  "aria-describedby": ariaDescribedBy,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search query
  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const canCreate =
    allowCreate &&
    searchQuery.trim().length > 0 &&
    !options.some(
      (opt) => opt.label.toLowerCase() === searchQuery.trim().toLowerCase()
    );

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
      setHighlightedIndex(0);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  function handleSelect(val: string) {
    onChange(val);
    setIsOpen(false);
  }

  function handleCreate() {
    if (onCreateNew && searchQuery.trim()) {
      onCreateNew(searchQuery.trim());
      setIsOpen(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const totalCount = filteredOptions.length + (canCreate ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % totalCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalCount) % totalCount);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (canCreate && highlightedIndex === filteredOptions.length) {
        handleCreate();
      } else if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full text-[var(--text-sm)]", className)}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={hasError}
        aria-describedby={ariaDescribedBy}
        className={cn(
          "w-full h-[var(--input-height)] px-3 rounded-[var(--input-radius)] bg-[var(--input-bg)] border flex items-center justify-between gap-2 text-left transition-colors focus:outline-none",
          hasError
            ? "border-[var(--input-border-error)] focus:ring-1 focus:ring-[var(--input-border-error)]"
            : "border-[var(--input-border)] focus:border-[var(--input-border-focus)] focus:ring-1 focus:ring-[var(--input-border-focus)]",
          disabled && "opacity-50 cursor-not-allowed bg-[var(--color-surface-sunken)]"
        )}
      >
        <span
          className={cn(
            "truncate",
            selectedOption ? "text-[var(--color-fg)]" : "text-[var(--color-fg-subtle)]"
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "text-[var(--color-fg-muted)] transition-transform flex-shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input */}
          <div className="p-2 border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)] relative">
            <Search
              size={14}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)] pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-8 pl-8 pr-7 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--text-xs)] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Options List */}
          <ul
            role="listbox"
            className="max-h-56 overflow-y-auto p-1 divide-y divide-[var(--color-border)]"
          >
            {filteredOptions.length === 0 && !canCreate && (
              <li className="px-3 py-4 text-center text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                No matching options
              </li>
            )}

            {filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    "px-3 py-2 rounded-[var(--radius-sm)] flex items-center justify-between gap-2 cursor-pointer transition-colors text-[var(--text-xs)]",
                    isHighlighted ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : "text-[var(--color-fg)]",
                    isSelected && "font-semibold"
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate">{opt.label}</p>
                    {opt.sublabel && (
                      <p className="text-[11px] text-[var(--color-fg-muted)] truncate">{opt.sublabel}</p>
                    )}
                  </div>
                  {isSelected && <Check size={14} className="text-[var(--color-primary)] flex-shrink-0" />}
                </li>
              );
            })}

            {/* Inline Create Option */}
            {canCreate && (
              <li
                role="option"
                aria-selected={false}
                onClick={handleCreate}
                onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
                className={cn(
                  "px-3 py-2 rounded-[var(--radius-sm)] flex items-center gap-2 cursor-pointer transition-colors text-[var(--text-xs)] font-medium text-[var(--color-primary)]",
                  highlightedIndex === filteredOptions.length ? "bg-[var(--color-primary-subtle)]" : ""
                )}
              >
                <Plus size={14} className="flex-shrink-0" />
                <span className="truncate">
                  Create <strong>&quot;{searchQuery.trim()}&quot;</strong>
                </span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
