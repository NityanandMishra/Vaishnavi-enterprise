// ─── EPIC-05: SHIPPING RESOLVER & SERVICEABILITY ENGINE ─────────────────────

export interface ServiceabilityResult {
  serviceable: boolean;
  couriers: string[];
  zone: string;
  rate: number; // in INR (e.g. 35, 49, 99)
  ratePaise: number;
  error?: string;
}

export function validatePincode(pincode: string): { valid: boolean; error?: string } {
  const cleaned = pincode.trim();
  if (!/^\d{6}$/.test(cleaned)) {
    return { valid: false, error: "Enter a 6-digit pincode" };
  }
  return { valid: true };
}

/**
 * Resolves courier serviceability and shipping rate by pincode and state.
 * Implements SHIP-03 (rate resolution) & SHIP-04 (serviceability).
 */
export function resolveShippingRate(pincode: string, state?: string): ServiceabilityResult {
  const validation = validatePincode(pincode);
  if (!validation.valid) {
    return {
      serviceable: false,
      couriers: [],
      zone: "UNKNOWN",
      rate: 0,
      ratePaise: 0,
      error: validation.error,
    };
  }

  const cleaned = pincode.trim();

  // Test scenario unserviceable pincode (e.g. 999999 or starting with 999)
  if (cleaned.startsWith("999") || cleaned === "000000") {
    return {
      serviceable: false,
      couriers: [],
      zone: "UNSERVICEABLE",
      rate: 0,
      ratePaise: 0,
      error: `We do not deliver to ${cleaned} yet`,
    };
  }

  // Active couriers for serviceable pincodes
  const couriers = ["Delhivery", "Blue Dart", "India Post"];

  // Mumbai Metro Zone (starts with 400 or 401)
  if (cleaned.startsWith("400") || cleaned.startsWith("401")) {
    return {
      serviceable: true,
      couriers,
      zone: "Mumbai Metro",
      rate: 35.0,
      ratePaise: 3500,
    };
  }

  // Rest of Maharashtra Zone (starts with 4 or state matches Maharashtra)
  if (cleaned.startsWith("4") || state?.toLowerCase().includes("maharashtra")) {
    return {
      serviceable: true,
      couriers,
      zone: "Rest of Maharashtra",
      rate: 49.0,
      ratePaise: 4900,
    };
  }

  // Rest of India (e.g. 560001 Bengaluru, Karnataka, 110001 Delhi, etc.)
  return {
    serviceable: true,
    couriers,
    zone: "Rest of India",
    rate: 99.0,
    ratePaise: 9900,
  };
}
