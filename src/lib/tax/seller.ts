import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getStateNameByCode, validateGSTIN } from "@/lib/tax/indian-states";

// Seller identity lives in TaxSettings and is maintained in Admin → Tax Settings.
// There are deliberately no fallbacks: a wrong seller state silently produces the
// wrong CGST/SGST vs IGST split, and a wrong GSTIN produces an invalid invoice.

type Db = Pick<Prisma.TransactionClient, "taxSettings">;

export const SELLER_SETTINGS_PATH = "/admin/tax/settings";

export class SellerNotConfiguredError extends Error {
  readonly statusCode = 422;
  constructor(public readonly problems: string[]) {
    super(
      `Seller details in Admin → Tax Settings are incomplete or invalid: ${problems.join("; ")}.`
    );
    this.name = "SellerNotConfiguredError";
  }
}

export interface SellerIdentity {
  name: string;
  tradeName?: string;
  gstin: string;
  stateCode: string;
  state: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
}

type SellerSettings = {
  sellerLegalName: string | null;
  sellerTradeName: string | null;
  sellerGstin: string | null;
  sellerStateCode: string | null;
  sellerAddressLine1: string | null;
  sellerAddressLine2: string | null;
  sellerCity: string | null;
  sellerPincode: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
};

const REQUIRED_FIELDS: Array<[keyof SellerSettings, string]> = [
  ["sellerLegalName", "legal name"],
  ["sellerGstin", "GSTIN"],
  ["sellerStateCode", "state"],
  ["sellerAddressLine1", "address"],
  ["sellerCity", "city"],
  ["sellerPincode", "pincode"],
  ["sellerPhone", "phone"],
  ["sellerEmail", "email"],
];

/** Lists what is missing or inconsistent; an empty list means the seller can invoice. */
export function sellerIdentityProblems(settings: SellerSettings | null): string[] {
  if (!settings) return ["Tax Settings have not been saved yet"];

  const missing = REQUIRED_FIELDS.filter(([key]) => !settings[key]?.trim()).map(([, label]) => label);
  const problems = missing.length ? [`missing ${missing.join(", ")}`] : [];

  const gstin = settings.sellerGstin?.trim().toUpperCase();
  if (gstin) {
    const check = validateGSTIN(gstin);
    if (!check.isValid) problems.push(`GSTIN: ${check.error}`);
    else if (settings.sellerStateCode && gstin.slice(0, 2) !== settings.sellerStateCode) {
      problems.push(
        `GSTIN starts with ${gstin.slice(0, 2)} but the registered state code is ${settings.sellerStateCode}`
      );
    }
  }
  if (settings.sellerPincode && !/^\d{6}$/.test(settings.sellerPincode.trim())) {
    problems.push("pincode must be 6 digits");
  }

  return problems;
}

/** Seller's GST state code, needed for every tax split. Throws if not configured. */
export async function getSellerStateCode(db: Db = prisma): Promise<string> {
  const settings = await db.taxSettings.findFirst({ select: { sellerStateCode: true } });
  if (!settings?.sellerStateCode) throw new SellerNotConfiguredError(["missing state"]);
  return settings.sellerStateCode;
}

/** Full seller identity for an invoice. Throws SellerNotConfiguredError listing every problem. */
export async function getSellerIdentity(db: Db = prisma): Promise<SellerIdentity> {
  const s = await db.taxSettings.findFirst();
  const problems = sellerIdentityProblems(s);
  if (!s || problems.length) throw new SellerNotConfiguredError(problems);

  return {
    name: s.sellerLegalName!.trim(),
    tradeName: s.sellerTradeName?.trim() || undefined,
    gstin: s.sellerGstin!.trim().toUpperCase(),
    stateCode: s.sellerStateCode!,
    state: getStateNameByCode(s.sellerStateCode!),
    address: [s.sellerAddressLine1, s.sellerAddressLine2].filter((l) => l?.trim()).join(", "),
    city: s.sellerCity!.trim(),
    pincode: s.sellerPincode!.trim(),
    phone: s.sellerPhone!.trim(),
    email: s.sellerEmail!.trim(),
  };
}
