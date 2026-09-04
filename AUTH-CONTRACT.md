# Phase 2 — Claims Contract

VECTA and CATERLINK share one Supabase project/database (see
`MIGRATION-AUDIT.md`). **This repo's schema migrations (`supabase/
migrations/`) only add CaterLink's own tables** (`cl_transactions` etc.) —
`public.profiles`, `public.users`, `current_user_role()`, and the new
claims-contract objects below are all defined in VECTA's
`supabase/migrations/`, since that's the repo that owns the shared account
tables. This file mirrors VECTA's `AUTH-CONTRACT.md` for CaterLink's
reference; VECTA's copy is normative if the two ever drift.

## Claim table

| Claim | Type | Meaning | Required |
|---|---|---|---|
| `role` | `"authenticated"` | Postgres role — mandatory or Supabase RLS rejects the token | yes |
| `app_role` | `admin\|management\|enforcement\|so\|aso\|dse\|vendor` | app role (the `unified_role` vocabulary — see caveat below) | yes |
| `team` | `operation\|ifc\|hub\|null` | AVSEC team | VECTA only — always `null` for CaterLink accounts |
| `station` | text \| null | hub/AVSEC station | VECTA only — always `null` for CaterLink accounts |
| `staff_id` | string | AirAsia staff ID | AVSEC users |
| `vendor_id` | string \| null | vendor company | CaterLink vendors — **not modeled yet**, see caveat |
| `email` | string | identity | yes |

## Caveat: `app_role` is NOT the same vocabulary as `current_user_role()`

`current_user_role()` (defined in VECTA's migrations, used by every RLS
policy in this repo's `cl_*` tables) reads `public.users.role` — the
**original** per-app role vocabulary: `warehouse_pic`, `vendor`,
`driver_vendor`, `post2_avsec`, etc. `app_role` above is the **different,
coarser** `unified_role` vocabulary. CaterLink's own driver/vendor roles
(`warehouse_pic`, `vendor`/`driver_vendor`) are **not currently part of the
`unified_role` check constraint** (`admin | management | enforcement | so
| aso | dse | vendor` — `vendor` is the one CaterLink-relevant value in
that list). Every `cl_*` RLS policy in this repo checks
`current_user_role()`, not `app_role`/`current_app_role()` — this phase
does not change that, for the same "don't touch what dozens of live
policies are hardcoded against" reason VECTA's contract documents.

## `vendor_id`: not modeled yet

No `vendor_id` column exists anywhere in the schema — CaterLink's earlier
`pin_drivers.vendor_id` design was dropped
(`supabase/migrations/20260819000003_drop_pin_drivers.sql`). Vendor
association today is purely `users.role = 'vendor'` (or, per RLS,
`driver_vendor` — see the role-naming mismatch flagged in
`supabase/tests/database/rls_driver_vendor_access.test.sql`'s header,
found while writing this phase's tests and left for a separate fix) plus
`created_by` on `cl_transactions`/`cl_form_a` rows.

## Team separation

CaterLink accounts (`warehouse_pic`, `vendor`/`driver_vendor`) never carry
`team`/`station`/an AVSEC ops_group — those claims are VECTA-only.
`supabase/tests/database/rls_driver_vendor_access.test.sql` in this repo
proves the CaterLink half of separation property 4 ("drivers/vendors are
... accepted by CaterLink"): a `driver_vendor` account can create a
`VENDOR_SUPPLY` delivery, a `warehouse_pic` account can create a
non-vendor delivery, and an AVSEC checkpoint-only role
(`post2_avsec`) is rejected by `cl_transactions`' creator-only insert
policy. The other half — an AVSEC-only checkpoint rejecting a vendor-only
account — is tested in VECTA's own
`supabase/tests/database/rls_team_separation.test.sql`, since that's
where the checkpoint tables live. Neither file was executed in the
environment that wrote them (no local Postgres/Supabase CLI available);
run `supabase test db` before relying on the assertions.

## Next: Phase 3

Phase 3 wires Firebase Auth (Google Workspace sign-in) and
`/api/auth/sync-claims` (built in VECTA), which will actually set these
claims as Firebase custom claims per this contract, and register Firebase
with Supabase's Third-Party Auth so `auth.jwt()` on a Firebase-issued
token resolves the same way it does today for a Supabase-issued one —
this repo's `lib/auth/providers/firebase.ts` stub gets implemented then.
