-- ============================================================
-- CaterLink v2: fresh, CaterLink-owned schema replacing the v1
-- driver_ifc design, per the finalized "Roles & Transaction Flow" spec.
--
-- No new roles needed — CaterLink now reuses VECTA's EXISTING roles
-- directly (same Supabase Auth project, same accounts):
--   Creators:  warehouse_pic (standard/aircraft/hub/redq/maintenance/
--              inbound), driver_vendor (Vendor Supply — still
--              self-registers via CaterLink, the only role that does).
--   Signers (whichever team is a route's actual last checkpoint):
--     VENDOR_SUPPLY                        -> post2_avsec
--     MAINTENANCE                          -> post6_avsec
--     HUB                                  -> hub_avsec
--     STANDARD_OUTBOUND/AIRCRAFT_OUTBOUND/
--       REDQ/INBOUND (all end at Receiver) -> receiver
--
-- New tables (cl_ prefix, distinct from icms-airasia's
-- transactions/vendor_transactions/part_a/seals, which VECTA keeps
-- using unchanged for its own workflow — this migration never touches
-- them except to remove the now-dead v1 CaterLink RLS policies added
-- on top of them). VECTA owns everything between CREATED and
-- COMPLETED (checkpoint scanning, entirely in VECTA); CaterLink only
-- creates the transaction + QR, and records the final sign-off.
-- ============================================================

-- ------------------------------------------------------------
-- Remove v1 CaterLink RLS additions on the legacy tables — CaterLink
-- stops writing to transactions/part_a/seals/vendor_transactions/
-- vendor_part_a entirely now that cl_transactions exists.
-- ------------------------------------------------------------
drop policy if exists "transactions: driver_ifc reads own" on public.transactions;
drop policy if exists "transactions: driver_ifc creates" on public.transactions;
drop policy if exists "part_a: driver_ifc inserts own" on public.part_a;
drop policy if exists "seals: driver_ifc inserts own transaction's seals" on public.seals;
drop policy if exists "vendor_transactions: driver reads own" on public.vendor_transactions;
drop policy if exists "vendor_transactions: driver creates" on public.vendor_transactions;
drop policy if exists "vendor_part_a: driver inserts own" on public.vendor_part_a;

-- ------------------------------------------------------------
-- Role cleanup: driver_ifc is gone (no longer a distinct identity —
-- warehouse_pic IS the "IFC staff" creator role). The one v1 test
-- account (driver_ifc, Adriansyah Bin Arahrioh) had already created a
-- real test transaction (ICMS-2026-000001), which public.transactions'
-- own no-delete trigger protects — deleting the account would violate
-- that FK, and deleting the transaction would violate VECTA's own
-- audit-integrity design. Deactivated instead: keeps the historical
-- row intact, permanently blocks sign-in (status='rejected'), and
-- gives the row a role value that survives the constraint swap below.
-- ------------------------------------------------------------
update public.users set role = 'driver_vendor', status = 'rejected'
where id = '2c9411de-c835-4d6d-afc0-40600ff7dc7e' and role = 'driver_ifc';

alter table public.users drop constraint users_role_check;
alter table public.users
  add constraint users_role_check
  check (role = any (array[
    'warehouse_pic', 'post2_avsec', 'post6_avsec', 'receiver',
    'supervisor', 'enforcement', 'vendor', 'hub_avsec', 'redq_avsec',
    'management', 'ops_staff',
    'driver_vendor'
  ]));

-- ------------------------------------------------------------
-- cl_transactions
-- ------------------------------------------------------------
create table public.cl_transaction_counters (
  year int primary key,
  counter int not null default 0
);

create or replace function public.cl_next_reference_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_counter int;
begin
  insert into cl_transaction_counters as ctc (year, counter)
  values (v_year, 1)
  on conflict (year) do update set counter = ctc.counter + 1
  returning counter into v_counter;

  return format('CL-%s-%s', v_year, lpad(v_counter::text, 6, '0'));
end;
$$;

create table public.cl_transactions (
  id uuid primary key default gen_random_uuid(),
  reference_number text unique not null default '',
  route text not null check (route in (
    'STANDARD_OUTBOUND', 'AIRCRAFT_OUTBOUND', 'VENDOR_SUPPLY',
    'HUB', 'REDQ', 'MAINTENANCE', 'INBOUND'
  )),
  vehicle_number text not null,
  driver_name text not null,
  driver_id text,
  cargo_types text[] not null default '{}',
  vehicle_search_completed boolean not null default false,
  qr_token text,
  completed_form_url text,
  status text not null default 'CREATED' check (status in ('CREATED', 'COMPLETED')),
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_cl_transactions_created_by on public.cl_transactions (created_by);
create index idx_cl_transactions_status on public.cl_transactions (status);
create index idx_cl_transactions_route on public.cl_transactions (route);

create or replace function public.cl_set_reference_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference_number is null or new.reference_number = '' then
    new.reference_number := public.cl_next_reference_number();
  end if;
  return new;
end;
$$;

create trigger trg_cl_set_reference_number
  before insert on public.cl_transactions
  for each row execute function public.cl_set_reference_number();

create trigger trg_cl_transactions_touch
  before update on public.cl_transactions
  for each row execute function public.touch_updated_at();

create trigger trg_cl_transactions_no_delete
  before delete on public.cl_transactions
  for each row execute function public.block_mutation();

-- ------------------------------------------------------------
-- cl_seals — write-once, mirrors the shape of the legacy `seals` table.
-- ------------------------------------------------------------
create table public.cl_seals (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.cl_transactions (id) on delete cascade,
  seal_number text not null,
  seal_type text not null check (seal_type in ('TRUCK_SEAL', 'TROLLEY', 'OTHER')),
  seal_color text not null check (seal_color in ('BLUE', 'GREEN', 'OTHER')),
  created_at timestamptz not null default now(),
  unique (transaction_id, seal_number)
);

create index idx_cl_seals_transaction on public.cl_seals (transaction_id);

create trigger trg_cl_seals_immutable
  before update or delete on public.cl_seals
  for each row execute function public.block_mutation();

-- ------------------------------------------------------------
-- cl_signoffs — one row per completed transaction. The trigger is the
-- real authority (security definer): it re-validates that signer_role
-- matches the route's mapped signing role and the transaction is still
-- CREATED, then flips cl_transactions to COMPLETED.
-- ------------------------------------------------------------
create table public.cl_signoffs (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid unique not null references public.cl_transactions (id) on delete cascade,
  signer_id uuid not null references public.users (id),
  signer_role text not null,
  signature_url text not null,
  signed_at timestamptz not null default now()
);

create or replace function public.cl_enforce_signoff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_route text;
  v_required_role text;
begin
  select status, route into v_status, v_route
  from cl_transactions where id = new.transaction_id for update;

  if v_status is null then
    raise exception 'CaterLink: transaction not found';
  end if;
  if v_status <> 'CREATED' then
    raise exception 'CaterLink: transaction is already %, cannot sign off again', v_status;
  end if;

  v_required_role := case v_route
    when 'VENDOR_SUPPLY' then 'post2_avsec'
    when 'MAINTENANCE' then 'post6_avsec'
    when 'HUB' then 'hub_avsec'
    else 'receiver' -- STANDARD_OUTBOUND, AIRCRAFT_OUTBOUND, REDQ, INBOUND
  end;

  if new.signer_role <> v_required_role then
    raise exception 'CaterLink: route % must be signed off by % (got %)', v_route, v_required_role, new.signer_role;
  end if;

  update cl_transactions set status = 'COMPLETED', completed_at = now() where id = new.transaction_id;
  return new;
end;
$$;

create trigger trg_cl_enforce_signoff
  before insert on public.cl_signoffs
  for each row execute function public.cl_enforce_signoff();

revoke execute on function public.cl_enforce_signoff() from public, anon, authenticated;

create trigger trg_cl_signoffs_immutable
  before update or delete on public.cl_signoffs
  for each row execute function public.block_mutation();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.cl_transactions enable row level security;
alter table public.cl_seals enable row level security;
alter table public.cl_signoffs enable row level security;
alter table public.cl_transaction_counters enable row level security;

create policy "cl_transactions: creator reads own"
  on public.cl_transactions for select
  using (
    public.current_user_role() = any (array['warehouse_pic', 'driver_vendor'])
    and created_by = auth.uid()
  );

-- Every operational role that might need to find a transaction awaiting
-- their sign-off (or just oversee the whole flow) sees all of them.
create policy "cl_transactions: operational roles read all"
  on public.cl_transactions for select
  using (
    public.current_user_role() = any (array[
      'post2_avsec', 'post6_avsec', 'hub_avsec', 'receiver', 'supervisor', 'enforcement'
    ])
  );

create policy "cl_transactions: creator creates"
  on public.cl_transactions for insert
  with check (
    public.current_user_role() = any (array['warehouse_pic', 'driver_vendor'])
    and created_by = auth.uid()
    and status = 'CREATED'
    and (
      (public.current_user_role() = 'driver_vendor' and route = 'VENDOR_SUPPLY')
      or (public.current_user_role() = 'warehouse_pic' and route <> 'VENDOR_SUPPLY')
    )
  );

-- No client-facing UPDATE policy: status only ever transitions via the
-- security-definer cl_enforce_signoff() trigger above.

create policy "cl_seals: read follows transaction visibility"
  on public.cl_seals for select
  using (exists (select 1 from public.cl_transactions t where t.id = transaction_id));

create policy "cl_seals: creator inserts own transaction's seals"
  on public.cl_seals for insert
  with check (
    public.current_user_role() = any (array['warehouse_pic', 'driver_vendor'])
    and exists (
      select 1 from public.cl_transactions t
      where t.id = transaction_id and t.created_by = auth.uid()
    )
  );

create policy "cl_signoffs: read follows transaction visibility"
  on public.cl_signoffs for select
  using (exists (select 1 from public.cl_transactions t where t.id = transaction_id));

create policy "cl_signoffs: matching role signs off"
  on public.cl_signoffs for insert
  with check (
    public.current_user_role() = any (array['post2_avsec', 'post6_avsec', 'hub_avsec', 'receiver'])
    and signer_id = auth.uid()
    and signer_role = public.current_user_role()
  );

-- cl_transaction_counters is only reachable from the security-definer
-- cl_next_reference_number() function above.
