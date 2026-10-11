import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { requireRole, type AuthenticatedUser } from "@/lib/tax/auth-helper";

// ─── Role groups for /api/admin routes ───────────────────────────────────────
// ADMIN and SUPER_ADMIN are always allowed by requireRole().
export const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN", "CATALOG_MANAGER", "FINANCE", "OPS_EXECUTIVE"];
export const ADMIN_ONLY = ["ADMIN", "SUPER_ADMIN"];
export const CATALOG_WRITE_ROLES = ["CATALOG_MANAGER"];
export const INVENTORY_ADJUST_ROLES = ["CATALOG_MANAGER", "OPS_EXECUTIVE"];
export const ORDER_READ_ROLES = ["OPS_EXECUTIVE", "FINANCE"];
export const ORDER_WRITE_ROLES = ["OPS_EXECUTIVE"];
export const FINANCE_ROLES = ["FINANCE"];
export const LEAD_ROLES = ["OPS_EXECUTIVE"]; // product enquiries (INQUIRE) contain customer contact details
export const TAX_READ_ROLES = ["FINANCE", "CATALOG_MANAGER"]; // matches requireTaxRead()

type GuardResult =
  | { user: AuthenticatedUser; response?: undefined }
  | { user?: undefined; response: NextResponse };

/**
 * Shared auth guard for /api/admin route handlers.
 *
 *   const auth = await guardApiRole(ORDER_WRITE_ROLES);
 *   if (auth.response) return auth.response;
 *   const user = auth.user;
 */
export async function guardApiRole(allowedRoles: string[]): Promise<GuardResult> {
  try {
    const user = await requireRole(allowedRoles);
    return { user };
  } catch (err: any) {
    if (err?.message === "UNAUTHORIZED") {
      return { response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
    }
    if (err?.message === "FORBIDDEN") {
      return { response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
    }
    throw err;
  }
}

/**
 * Guard for /api/internal routes: requires the `x-internal-secret` header to
 * match INTERNAL_API_SECRET. Fails closed when the env var is unset.
 * Returns a response to send back on failure, or null when the caller is allowed.
 */
export function guardInternalApi(req: Request): NextResponse | null {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error("INTERNAL_API_SECRET is not set; rejecting internal API call");
    return NextResponse.json({ error: "INTERNAL_API_DISABLED" }, { status: 503 });
  }

  const provided = req.headers.get("x-internal-secret");
  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

/** Constant-time string comparison that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
