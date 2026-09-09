import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";

export interface AuthenticatedUser {
  id: string;
  name: string;
  role: string;
  email?: string;
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return null;
  const user = session.user as any;
  return {
    id: user.id || "system",
    name: user.name || "Admin",
    role: user.role || "ADMIN",
    email: user.email,
  };
}

export async function requireRole(allowedRoles: string[]): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  // Treat "ADMIN" and "SUPER_ADMIN" as equivalent superuser privileges
  const hasAccess =
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    allowedRoles.includes(user.role);

  if (!hasAccess) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

// Specific role helpers per PRD Table B.1
export const requireUnitsWrite = () =>
  requireRole(["SUPER_ADMIN", "ADMIN", "CATALOG_MANAGER", "FINANCE"]);

export const requireUnitsRead = () =>
  requireRole(["SUPER_ADMIN", "ADMIN", "CATALOG_MANAGER", "FINANCE", "OPS_EXECUTIVE"]);

export const requireTaxWrite = () =>
  requireRole(["SUPER_ADMIN", "ADMIN", "FINANCE"]);

export const requireTaxRead = () =>
  requireRole(["SUPER_ADMIN", "ADMIN", "FINANCE", "CATALOG_MANAGER"]);

export const requireTaxSettingsWrite = () =>
  requireRole(["SUPER_ADMIN", "ADMIN"]); // SUPER_ADMIN only

export const requireTaxSettingsRead = () =>
  requireRole(["SUPER_ADMIN", "ADMIN", "FINANCE"]);
