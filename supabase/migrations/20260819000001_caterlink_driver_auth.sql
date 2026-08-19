-- ============================================================
-- CaterLink: driver identities for the Vendor Movement Module
-- Part A (AA/SEC/F/019), on top of the vendor_transactions schema
-- already applied by 20260813000002_vendor_movement.sql (shared
-- with VECTA — do not alter that migration).
--
-- Two new driver roles, both allowed to create vendor_transactions
-- Part A exactly like icms-airasia's original 'vendor' role could:
--   driver_ifc     AirAsia staff, Google Workspace SSO (auth.users
--                   row created by Supabase's Google provider; the
--                   matching public.users row is created lazily on
--                   first sign-in, see src/lib/actions/ifc-auth.ts).
--   driver_vendor   Third-party vendor driver, Driver Code + PIN
--                   login (no email). Each driver gets a real,
--                   passwordless Supabase Auth user at creation
--                   time so auth.uid() and RLS work unmodified;
--                   public.vendor_drivers holds the PIN + profile
--                   fields keyed 1:1 on that same uuid.
--
-- The existing 'vendor' role (vendor company account) is untouched
-- and keeps its own icms-airasia behavior; in CaterLink it is used
-- only as the admin account that registers vendor_drivers rows.
-- ============================================================

alter table public.users drop constraint users_role_check;
alter table public.users
  add constraint users_role_check
  check (role = any (array[
    'warehouse_pic', 'post2_avsec', 'post6_avsec', 'receiver',
    'supervisor', 'enforcement', 'vendor', 'hub_avsec', 'redq_avsec',
    'driver_ifc', 'driver_vendor'
  ]));

-- ------------------------------------------------------------
-- vendor_drivers
-- ------------------------------------------------------------
create table public.vendor_drivers (
  id uuid primary key references auth.users (id) on delete cascade,
  vendor_id uuid not null references public.users (id),
  driver_code text unique not null default '',
  pin_hash text not null,
  full_name text not null,
  ic_number text not null,
  phone text,
  vehicle_plate text,
  is_active boolean not null default true,
  failed_pin_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create index idx_vendor_drivers_vendor on public.vendor_drivers (vendor_id);
create index idx_vendor_drivers_driver_code on public.vendor_drivers (driver_code);

create table public.vendor_driver_code_counter (
  id boolean primary key default true check (id),
  counter int not null default 0
);
insert into public.vendor_driver_code_counter (id, counter) values (true, 0);

create or replace function public.next_driver_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counter int;
begin
  update vendor_driver_code_counter set counter = counter + 1
  where id = true
  returning counter into v_counter;

  return format('V-%s', lpad(v_counter::text, 4, '0'));
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
    new.driver_code := public.next_driver_code();
  end if;
  return new;
end;
$$;

create trigger trg_set_driver_code
  before insert on public.vendor_drivers
  for each row execute function public.set_driver_code();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.vendor_drivers enable row level security;
alter table public.vendor_driver_code_counter enable row level security;

-- Vendor company admins manage their own roster of drivers. PIN
-- verification itself happens with the service-role client (the
-- caller has no session yet at that point), so this policy only
-- ever gates the vendor-admin "add/deactivate a driver" screen.
create policy "vendor_drivers: vendor manages own roster"
  on public.vendor_drivers for all
  using (
    public.current_user_role() = 'vendor' and vendor_id = auth.uid()
  )
  with check (
    public.current_user_role() = 'vendor' and vendor_id = auth.uid()
  );

-- A signed-in driver can read (only) their own row, e.g. to show
-- their vehicle plate / vendor company on the home screen.
create policy "vendor_drivers: driver reads own row"
  on public.vendor_drivers for select
  using (
    public.current_user_role() = 'driver_vendor' and id = auth.uid()
  );

-- vendor_driver_code_counter is only reachable from the
-- security-definer next_driver_code() function above.

-- ------------------------------------------------------------
-- Extend the icms-airasia Vendor Movement RLS (20260813000002) to
-- the two new driver roles, mirroring the existing 'vendor' policies
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
