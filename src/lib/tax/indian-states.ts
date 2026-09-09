/**
 * Indian States & Union Territories with 2-digit GST State Codes
 * Reference: CBIC / GSTN State Code Master
 */

export interface IndianState {
  code: string;
  name: string;
}

export const INDIAN_STATES: IndianState[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "28", name: "Andhra Pradesh (Old)" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
];

export const STATE_BY_CODE = new Map<string, string>(
  INDIAN_STATES.map((s) => [s.code, s.name])
);

export function getStateNameByCode(code: string): string {
  const padded = code.padStart(2, "0");
  return STATE_BY_CODE.get(padded) || `State (${padded})`;
}

const STATE_ABBREVIATIONS: Record<string, string> = {
  UP: "09",
  MH: "27",
  DL: "07",
  KA: "29",
  GJ: "24",
  TN: "33",
  WB: "19",
  RJ: "08",
  MP: "23",
  HR: "06",
  PB: "03",
  AP: "37",
  TS: "36",
  TG: "36",
  KL: "32",
  BR: "10",
  BH: "10",
  JH: "20",
  UK: "05",
  UT: "05",
  CH: "04",
  GA: "30",
  OD: "21",
  OR: "21",
  CG: "22",
  CT: "22",
  AS: "18",
  JK: "01",
  HP: "02",
};

/**
 * Resolves a 2-digit GST state code from a state name, abbreviation, or numeric string.
 * Defaults to defaultCode (e.g. "27" or "09") if unrecognized.
 */
export function getStateCodeByName(nameOrInput?: string | null, defaultCode = "27"): string {
  if (!nameOrInput) return defaultCode;

  const trimmed = nameOrInput.trim();
  if (/^\d{1,2}$/.test(trimmed)) {
    const padded = trimmed.padStart(2, "0");
    if (STATE_BY_CODE.has(padded)) return padded;
  }

  const upper = trimmed.toUpperCase();
  if (STATE_ABBREVIATIONS[upper]) {
    return STATE_ABBREVIATIONS[upper];
  }

  const clean = upper.replace(/[^A-Z]/g, "");
  for (const s of INDIAN_STATES) {
    const stateClean = s.name.toUpperCase().replace(/[^A-Z]/g, "");
    if (clean === stateClean || clean.includes(stateClean) || stateClean.includes(clean)) {
      return s.code;
    }
  }

  return defaultCode;
}

/**
 * Validates GSTIN:
 * - Must be exactly 15 characters
 * - First 2 digits: valid state code (01-38 or 97)
 * - Next 10 characters: PAN format ([A-Z]{5}[0-9]{4}[A-Z]{1})
 * - 13th character: Entity number [1-9A-Z]
 * - 14th character: 'Z'
 * - 15th character: Checksum character [0-9A-Z]
 */
export function validateGSTIN(gstin: string): { isValid: boolean; error?: string } {
  const trimmed = gstin.trim().toUpperCase();

  if (trimmed.length !== 15) {
    return {
      isValid: false,
      error: "That does not look like a valid GSTIN. Expected 15 characters.",
    };
  }

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(trimmed)) {
    return {
      isValid: false,
      error: "Invalid GSTIN format. Expected: 2-digit state code + 10-char PAN + entity code + 'Z' + check digit (e.g. 27AABCV1234K1Z5).",
    };
  }

  const stateCode = trimmed.slice(0, 2);
  if (!STATE_BY_CODE.has(stateCode)) {
    return {
      isValid: false,
      error: `Invalid state code '${stateCode}'. Must be a recognized 2-digit Indian State / UT code.`,
    };
  }

  return { isValid: true };
}
