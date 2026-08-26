/**
 * Vaishnavi Enterprise — Money & Currency Utilities
 * Foundation Spec: 00 (D-07, NFR-05)
 *
 * Money storage rule:
 * Integer paise end to end: DB, API, and UI state.
 * E.g., ₹1,249.50 is stored as 124950. Formatting to ₹ happens ONLY at render.
 */

/**
 * Format integer paise into standard Indian Rupee string (₹X,XX,XXX.XX)
 * @param paise Amount in integer paise (e.g. 124950 for ₹1,249.50)
 * @param showPaiseIfZero If false, ₹1,200.00 renders as ₹1,200. Default: false
 */
export function formatPaise(
  paise: number | null | undefined,
  showPaiseIfZero: boolean = false
): string {
  if (paise === null || paise === undefined || isNaN(paise)) return "₹0";

  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(paise));
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;

  // Format whole rupee portion using Indian numbering system
  const rupeeString = rupees.toLocaleString("en-IN");

  const sign = isNegative ? "-" : "";

  if (remainingPaise === 0 && !showPaiseIfZero) {
    return `${sign}₹${rupeeString}`;
  }

  const paiseString = remainingPaise.toString().padStart(2, "0");
  return `${sign}₹${rupeeString}.${paiseString}`;
}

/**
 * Convert standard Rupee input (number or string like "1249.50" or "₹1,249.50") to integer paise.
 */
export function parsePaise(rupeeInput: string | number | null | undefined): number {
  if (rupeeInput === null || rupeeInput === undefined) return 0;
  if (typeof rupeeInput === "number") {
    return Math.round(rupeeInput * 100);
  }

  const cleanString = rupeeInput.replace(/[^0-9.-]+/g, "");
  const val = parseFloat(cleanString);
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}

/**
 * Convert integer paise to decimal rupees for calculation helpers
 */
export function paiseToRupees(paise: number): number {
  return (paise || 0) / 100;
}

/**
 * Convert decimal rupees to integer paise
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round((rupees || 0) * 100);
}
