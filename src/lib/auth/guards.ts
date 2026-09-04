import "server-only";

import { redirect } from "next/navigation";
import { getAuthProvider } from "./provider";
import { getClaims, type Claims } from "./claims";
import type { AuthUser, AuthRole } from "./types";

/** Provider-agnostic replacement for the Supabase SDK's getUser() call —
 *  identity only, returns null when signed out. Role/status still comes
 *  from lib/auth.ts's own profile table lookup until Phase 2's claims
 *  contract lands. */
export async function getAuthUser(): Promise<AuthUser | null> {
  return getAuthProvider().getUser();
}

/** Returns the signed-in user, or redirects to /login. */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Returns the signed-in user's full claim contract (AUTH-CONTRACT.md), or
 * redirects to /login. CaterLink's own driver/vendor roles aren't in the
 * app_role vocabulary today (see AUTH-CONTRACT.md's caveat) — lib/auth.ts's
 * own requireProfile()/requireRole() (which read current_user_role()
 * directly) remain the real guard for CaterLink's own pages.
 */
export async function requireClaims(): Promise<Claims> {
  const user = await requireAuth();
  const claims = await getClaims(user);
  if (!claims) redirect("/login?error=no-profile");
  return claims;
}

/** Requires one of the given coarse app_role values (unified_role
 *  vocabulary). Not useful for CaterLink's own warehouse_pic/vendor
 *  distinction today — see the caveat above — but available for any
 *  future check against the shared AVSEC vocabulary (e.g. rejecting an
 *  AVSEC-only account from a CaterLink-only page). */
export async function requireAppRole(roles: AuthRole[]): Promise<Claims> {
  const claims = await requireClaims();
  if (!claims.appRole || !roles.includes(claims.appRole)) {
    redirect("/dashboard?error=forbidden");
  }
  return claims;
}

/** CaterLink accounts never carry a team claim (VECTA-only) — always
 *  redirects. Kept for interface parity with VECTA's guards.ts. */
export function requireTeam(): never {
  throw new Error("CaterLink accounts have no team claim — this is a VECTA-only concept.");
}
