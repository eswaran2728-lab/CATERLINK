-- ============================================================
-- CaterLink: driver identities for both transaction types (Vendor
-- Movement Part A on top of 20260813000002_vendor_movement.sql, and
-- ICMS inbound/outbound Part A extended by
-- 20260819000002_caterlink_icms_driver.sql) — shared with VECTA, do
-- not alter those migrations.
--
-- Two new driver roles:
--   driver_ifc     AirAsia staff. Long-term: Google Workspace SSO
--                   (auth.users row created by Supabase's Google
--                   provider, public.users row created lazily on
--                   first sign-in — see src/app/auth/callback/route.ts).
--                   Short-term, until Google OAuth is configured:
--                   Driver Code + PIN via public.pin_drivers below,
--                   same mechanism as vendor drivers, admin-issued
--                   (see scripts/create-ifc-driver.mjs — no self-
--                   registration, matching VECTA's rule). Either path
--                   lands on the same driver_ifc role and RLS.
--   driver_vendor   Third-party vendor driver, Driver Code + PIN only
--                   (no email) — permanent, not a stand-in.
--
-- Both PIN-login paths share one table (public.pin_drivers) since the
-- login mechanism (bcrypt PIN check, passwordless Supabase Auth
-- session via magic-link OTP exchange) is identical; only who may
-- administer the roster differs — see the RLS below.
--
-- The existing 'vendor' role (vendor company account) is untouched
-- and keeps its own icms-airasia behavior; in CaterLink it is used
-- only as the admin account that registers driver_vendor rows.
-- ============================================================

-- The live users_role_check array is wider than icms-airasia's GitHub
-- repo shows (it already includes 'management'/'ops_staff', added by a
-- migration not present in that repo checkout) — reproduced verbatim
-- here, plus the two new CaterLink roles, rather than the stale list
-- from the repo, so this ALTER doesn't drop roles already in use.
alter table public.users drop constraint users_role_check;
alter table public.users
  add constraint users_role_check
  check (role = any (array[
    'warehouse_pic', 'post2_avsec', 'post6_avsec', 'receiver',
    'supervisor', 'enforcement', 'vendor', 'hub_avsec', 'redq_avsec',
    'management', 'ops_staff',
    'driver_ifc', 'driver_vendor'
  ]));

-- ------------------------------------------------------------
-- pin_drivers
-- ------------------------------------------------------------
create table public.pin_drivers (
  id uuid primary key references auth.users (id) on delete cascade,
  driver_role text not null check (driver_role in ('driver_ifc', 'driver_vendor')),
  -- Only set (and required) for driver_vendor rows — the vendor company
  -- ('vendor' role) account that owns/administers this driver. driver_ifc
  -- rows have no company owner; see the check constraint below.
  vendor_id uuid references public.users (id),
  driver_code text unique not null default '',
  pin_hash text not null,
  full_name text not null,
  -- Vendor drivers are identified by NRIC; IFC drivers by their ICMS
  -- whitelist staff_id (public.drivers.staff_id) — exactly one applies,
  -- matching driver_role.
  ic_number text,
  staff_id text,
  phone text,
  vehicle_plate text,
  is_active boolean not null default true,
  failed_pin_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  constraint pin_drivers_vendor_ownership_check check (
    (driver_role = 'driver_vendor' and vendor_id is not null and ic_number is not null)
    or (driver_role = 'driver_ifc' and vendor_id is null)
  )
);

create index idx_pin_drivers_vendor on public.pin_drivers (vendor_id);
create index idx_pin_drivers_driver_code on public.pin_drivers (driver_code);
create index idx_pin_drivers_role on public.pin_drivers (driver_role);

create table public.pin_driver_code_counter (
  driver_role text primary key,
  counter int not null default 0
);
insert into public.pin_driver_code_counter (driver_role, counter) values
  ('driver_vendor', 0),
  ('driver_ifc', 0);

-- Prefix distinguishes the two roles at a glance (V-0001, I-0001);
-- counters are independent so neither role's numbering shifts when the
-- other grows.
create or replace function public.next_driver_code(p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counter int;
  v_prefix text;
begin
  if p_role not in ('driver_ifc', 'driver_vendor') then
    raise exception 'ICMS: invalid driver role %', p_role;
  end if;
  v_prefix := case p_role when 'driver_ifc' then 'I' else 'V' end;

  update pin_driver_code_counter set counter = counter + 1
  where driver_role = p_role
  returning counter into v_counter;

  return format('%s-%s', v_prefix, lpad(v_counter::text, 4, '0'));
end;
$$;

create or replace function public.set_driver_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.driver_code is null or new.driver_code = '' then
    new.driver_code := public.next_driver_code(new.driver_role);
  end if;
  return new;
end;
$$;

create trigger trg_set_driver_code
  before insert on public.pin_drivers
  for each row execute function public.set_driver_code();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.pin_drivers enable row level security;
alter table public.pin_driver_code_counter enable row level security;

-- Vendor company admins manage their own roster of driver_vendor rows
-- only (never driver_ifc rows — vendor_id is null there, so this never
-- matches). PIN verification itself happens with the service-role
-- client (the caller has no session yet at that point), so this policy
-- only ever gates the vendor-admin "add/deactivate a driver" screen.
create policy "pin_drivers: vendor manages own roster"
  on public.pin_drivers for all
  using (
    public.current_user_role() = 'vendor' and vendor_id = auth.uid()
  )
  with check (
    public.current_user_role() = 'vendor' and vendor_id = auth.uid()
  );

-- A signed-in driver can read (only) their own row, e.g. to show their
-- vehicle plate / vendor company on the home screen. driver_ifc rows
-- created via scripts/create-ifc-driver.mjs (service role, bypasses
-- RLS) — no client-facing insert policy for driver_ifc, matching "no
-- self-registration for internal ICMS drivers".
create policy "pin_drivers: driver reads own row"
  on public.pin_drivers for select
  using (
    public.current_user_role() = any (array['driver_ifc', 'driver_vendor'])
    and id = auth.uid()
  );

-- pin_driver_code_counter is only reachable from the security-definer
-- next_driver_code() function above.

-- ------------------------------------------------------------
-- Extend the icms-airasia Vendor Movement RLS (20260813000002) to the
-- two new driver roles, mirroring the existing 'vendor' policies
-- exactly (own-rows-only visibility, insert-as-self).
-- ------------------------------------------------------------
create policy "vendor_transactions: driver reads own"
  on public.vendor_transactions for select
  using (
    public.current_user_role() = any (array['driver_ifc', 'driver_vendor'])
    and created_by = auth.uid()
  );

create policy "vendor_transactions: driver creates"
  on public.vendor_transactions for insert
  with check (
    public.current_user_role() = any (array['driver_ifc', 'driver_vendor'])
    and created_by = auth.uid()
    and status = 'CREATED'
  );

create policy "vendor_part_a: driver inserts own"
  on public.vendor_part_a for insert
  with check (
    public.current_user_role() = any (array['driver_ifc', 'driver_vendor'])
    and completed_by = auth.uid()
    and exists (
      select 1 from public.vendor_transactions vt
      where vt.id = transaction_id and vt.created_by = auth.uid()
    )
  );
