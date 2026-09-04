import type { AuthUser } from "./types";

/**
 * Placeholder for Phase 2's claims contract (AUTH-CONTRACT.md): the
 * single source of truth guards.ts will read role/vendor_id from once
 * user_claims exists in Supabase and both provider adapters normalise
 * to it.
 *
 * For now this is a pass-through — role/status resolution is unchanged
 * and still lives in lib/auth.ts's own profile table lookup.
 */
export function normalizeUser(user: AuthUser | null): AuthUser | null {
  return user;
}
