-- Phase 2 (claims contract, AUTH-CONTRACT.md): proves the CaterLink half
-- of "drivers/vendors are rejected by VECTA, accepted by CaterLink" (the
-- VECTA half — an AVSEC-only checkpoint rejecting a vendor-only account —
-- is tested in VECTA's own supabase/tests/database/rls_team_separation.
-- test.sql, since that's where the checkpoint tables live). This repo
-- shares one Supabase project/database with VECTA (see
-- MIGRATION-AUDIT.md), so current_user_role() and public.users here are
-- the same objects VECTA's migrations define.
--
-- Run with the Supabase CLI: `supabase test db`. NOT executed as part of
-- writing this file — no local Postgres/Supabase CLI is available in
-- this environment. Run it before relying on these assertions.
--
-- NOTE — pre-existing issue found while writing this test, out of scope
-- for this phase: cl_transactions' insert policy only grants
-- 'warehouse_pic' and 'driver_vendor', but src/lib/actions/registration.ts
-- (self-registered vendor drivers) and src/app/api/dev-seed/route.ts both
-- hardcode role: "vendor" — a value that policy never matches. As written
-- today, a self-registered vendor driver cannot create a delivery at all.
-- This test uses 'driver_vendor' (what RLS actually grants) to verify the
-- real policy; it does not paper over the 'vendor' vs 'driver_vendor'
-- mismatch, which is a separate bug from the auth migration this phase
-- covers. Flagged separately, not fixed here.

begin;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'test-driver-vendor@example.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'test-warehouse-pic@example.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'test-post2-avsec@example.test');

insert into public.users (id, email, name, staff_id, status, role)
values
  ('00000000-0000-0000-0000-0000000000c1', 'test-driver-vendor@example.test', 'Test Driver Vendor', 'T-DV-1', 'active', 'driver_vendor'),
  ('00000000-0000-0000-0000-0000000000c2', 'test-warehouse-pic@example.test', 'Test Warehouse PIC', 'T-WP-1', 'active', 'warehouse_pic'),
  ('00000000-0000-0000-0000-0000000000c3', 'test-post2-avsec@example.test', 'Test Post2 AVSEC', 'T-P2-1', 'active', 'post2_avsec');

-- ---------------------------------------------------------------------
-- A driver_vendor account CAN create a VENDOR_SUPPLY delivery.
-- ---------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1"}';

select lives_ok(
  $$ insert into public.cl_transactions (route, vehicle_number, driver_name, created_by)
     values ('VENDOR_SUPPLY', 'TEST-1', 'Test Driver', '00000000-0000-0000-0000-0000000000c1') $$,
  'driver_vendor is accepted by cl_transactions insert RLS for a VENDOR_SUPPLY delivery'
);

-- ---------------------------------------------------------------------
-- A warehouse_pic account CAN create a non-vendor delivery.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2"}';

select lives_ok(
  $$ insert into public.cl_transactions (route, vehicle_number, driver_name, created_by)
     values ('STANDARD_OUTBOUND', 'TEST-2', 'Test Driver', '00000000-0000-0000-0000-0000000000c2') $$,
  'warehouse_pic is accepted by cl_transactions insert RLS for a non-vendor delivery'
);

-- ---------------------------------------------------------------------
-- An AVSEC checkpoint-only account (post2_avsec — never creates a
-- delivery, only signs one off) is rejected by the creator-only insert
-- policy, same as CaterLink's UI already refuses to show it that option.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3"}';

select throws_ok(
  $$ insert into public.cl_transactions (route, vehicle_number, driver_name, created_by)
     values ('STANDARD_OUTBOUND', 'TEST-3', 'Test Driver', '00000000-0000-0000-0000-0000000000c3') $$,
  '42501',
  null,
  'post2_avsec (an AVSEC checkpoint-only role) is rejected by cl_transactions insert RLS — it only signs off, never creates'
);

select * from finish();
rollback;
