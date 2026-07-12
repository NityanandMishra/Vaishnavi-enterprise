import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Indian Rupees — e.g. 1,24,500 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Slugify a string — "Solar Panels" → "solar-panels" */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Truncate text to a max character count */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

/** Parse a JSON specs string safely */
export function parseSpecs(specs: string): Record<string, string> {
  try {
    return JSON.parse(specs);
  } catch {
    return {};
  }
}

/** Returns the WhatsApp chat URL for the owner */
export function ownerWhatsAppUrl(message?: string): string {
  const phone = "917388847575";
  const text = message ?? "Hello, I have a question about your products.";
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
