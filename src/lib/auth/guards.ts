import "server-only";

import { redirect } from "next/navigation";
import { getAuthProvider } from "./provider";
import type { AuthUser } from "./types";

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
 * requireRole()/requireTeam() are deferred to Phase 2 (AUTH-CONTRACT.md):
 * AuthUser carries no role/vendor_id yet, so there is nothing
 * provider-agnostic to check here. lib/auth.ts's own requireRole()
 * remains the real guard until then.
 */
export function requireRole(): never {
  throw new Error("requireRole() lands in Phase 2 once claims carry app_role.");
}
export function requireTeam(): never {
  throw new Error("requireTeam() lands in Phase 2 once claims carry team/station.");
}
