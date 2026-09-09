import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Config URL aliases (/config/... -> /admin/...) ───────────────────────
  if (pathname.startsWith("/config/units")) {
    const targetUrl = new URL(pathname.replace("/config/units", "/admin/units"), req.url);
    targetUrl.search = req.nextUrl.search;
    return NextResponse.redirect(targetUrl);
  }
  if (pathname.startsWith("/config/tax")) {
    const targetUrl = new URL(pathname.replace("/config/tax", "/admin/tax"), req.url);
    targetUrl.search = req.nextUrl.search;
    return NextResponse.redirect(targetUrl);
  }

  // ── Admin route protection ──────────────────────────────────────────────
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Not logged in → redirect to unified login with admin callback
    if (!token) {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Logged in but not an admin role → redirect to customer account
    const role = token.role as string | undefined;
    const adminRoles = ["ADMIN", "SUPER_ADMIN", "CATALOG_MANAGER", "FINANCE", "OPS_EXECUTIVE"];
    if (!role || !adminRoles.includes(role)) {
      return NextResponse.redirect(new URL("/account", req.url));
    }
  }

  // ── Customer account route protection ──────────────────────────────────
  if (pathname.startsWith("/account") || pathname.startsWith("/checkout")) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/config/:path*", "/account/:path*", "/checkout/:path*"],
};
