-- ============================================================
-- CaterLink: drop the Driver Code + PIN mechanism (pin_drivers),
-- superseded by plain self-registration + VECTA admin approval
-- (see src/lib/actions/registration.ts, reusing icms-airasia's
-- existing pending/active/rejected status pattern). Never had any
-- rows in production, so this is a clean removal.
--
-- The driver_ifc/driver_vendor roles themselves, and all RLS on
-- transactions/part_a/seals/vendor_transactions/vendor_part_a for
-- those roles (20260819000001, 20260819000002), are UNCHANGED —
-- they only check current_user_role(), independent of how the
-- session was established.
-- ============================================================

drop table if exists public.pin_drivers;
drop table if exists public.pin_driver_code_counter;
drop function if exists public.next_driver_code(text);
drop function if exists public.set_driver_code();
