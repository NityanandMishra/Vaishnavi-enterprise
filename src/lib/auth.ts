import { getAuthenticatedUser, AuthenticatedUser, requireRole } from "./tax/auth-helper";

export { getAuthenticatedUser, requireRole };
export type { AuthenticatedUser };

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  return await getAuthenticatedUser();
}
