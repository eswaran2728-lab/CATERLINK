import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AuthUser, AuthRole } from "./types";

/** The full claim contract — see AUTH-CONTRACT.md. CaterLink accounts
 *  never carry team/station (VECTA-only claims — always null here). */
export interface Claims {
  id: string;
  email: string | null;
  role: "authenticated";
  /** unified_role vocabulary. Note: CaterLink's own driver/vendor roles
   *  (warehouse_pic, vendor/driver_vendor) aren't part of that vocabulary
   *  today — see AUTH-CONTRACT.md's caveat. Every cl_* RLS policy checks
   *  current_user_role() (the per-app role), not this claim. */
  appRole: AuthRole | null;
  team: "operation" | "ifc" | "hub" | null;
  station: string | null;
  staffId: string | null;
  /** Always null today — no vendor_id column exists yet. See
   *  AUTH-CONTRACT.md's caveat. */
  vendorId: string | null;
  status: string | null;
}

/**
 * Resolves the full claim contract for a signed-in user by reading
 * public.user_claims (defined in VECTA's supabase/migrations/
 * claims_contract.sql — this repo shares that Supabase project/database,
 * see MIGRATION-AUDIT.md) — a DB round trip today. Once Phase 3 sets
 * these as Firebase custom claims and /api/auth/sync-claims (built in
 * VECTA) mirrors them, this becomes a JWT read with the same shape.
 *
 * user_claims is a new view not yet present in the generated
 * Database types (regenerating those requires a live linked project,
 * unavailable while writing this) — queried by name rather than through
 * the typed `.from()` overloads until types are regenerated.
 */
export async function getClaims(user: AuthUser | null): Promise<Claims | null> {
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_claims" as never)
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    id: string;
    email: string | null;
    app_role: string | null;
    team: "operation" | "ifc" | "hub" | null;
    station: string | null;
    staff_id: string | null;
    vendor_id: string | null;
    status: string | null;
  };
  return {
    id: row.id,
    email: row.email,
    role: "authenticated",
    appRole: row.app_role,
    team: row.team,
    station: row.station,
    staffId: row.staff_id,
    vendorId: row.vendor_id,
    status: row.status,
  };
}
