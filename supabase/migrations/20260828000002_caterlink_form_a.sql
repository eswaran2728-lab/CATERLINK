-- ============================================================
-- CaterLink: digitize Part A of the two paper AVSEC forms, captured at
-- transaction-creation time by the driver/warehouse side. The remaining
-- parts (B/C/D for IFCSF AA/SEC/F/010, B/C for Vendor Supplies
-- AA/SEC/F/019) are filled later in VECTA against the same transaction —
-- see the "For VECTA" note at the bottom of this file.
--
-- Reuse, not duplication, of fields already on cl_transactions/cl_seals:
--   - Station               -> new cl_transactions.station (header field,
--                              shared by Parts A-D, not Part-A-specific)
--   - Category checklist    -> already cl_transactions.cargo_types
--   - Inbound/Outbound      -> already cl_transactions.route
--   - Vehicle Registration  -> already cl_transactions.vehicle_number
--   - Outbound Seal Serial  -> already cl_seals.seal_number (IFCSF inbound)
--   - Seal Number (vendor)  -> already cl_seals.seal_number (vendor form)
--   - Driver name / NRIC    -> already cl_transactions.driver_name/driver_id
--                              (vendor Part A only)
-- ============================================================

alter table public.cl_transactions add column station text;

-- ------------------------------------------------------------
-- cl_form_a — one row per transaction, the driver/warehouse-side
-- certification. Columns are nullable at the table level because the two
-- forms need different subsets; cl_enforce_form_a() below enforces which
-- ones are actually required, based on the transaction's route.
-- ------------------------------------------------------------
create table public.cl_form_a (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid unique not null references public.cl_transactions (id) on delete cascade,

  -- IFCSF Part A (Outbound + Inbound) — total in-flight supplies breakdown.
  carts int check (carts is null or carts >= 0),
  smu int check (smu is null or smu >= 0),
  pallets int check (pallets is null or pallets >= 0),
  boxes int check (boxes is null or boxes >= 0),
  oven_rack int check (oven_rack is null or oven_rack >= 0),

  -- Vendor Supplies Part A — "IN-FLIGHT SUPPLIES CARTS/CONTAINERS/BINS"
  -- (a single free-text count/description, a different shape from the
  -- IFCSF numeric breakdown above, so kept as its own column).
  supplies_description text,

  -- Certifying signatory. IFCSF: the in-flight warehouse staff who
  -- searched the consignment (defaults to the creator's profile in the
  -- UI, editable/confirmable). Vendor Supplies Part A doesn't have a
  -- separate certifier line — the vendor driver's own name/NRIC
  -- (cl_transactions.driver_name/driver_id) already covers it, so these
  -- stay null for VENDOR_SUPPLY rows.
  certifying_name text,
  certifying_id text,

  signature_url text not null,
  certified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_cl_form_a_transaction on public.cl_form_a (transaction_id);

create trigger trg_cl_form_a_immutable
  before update or delete on public.cl_form_a
  for each row execute function public.block_mutation();

-- ------------------------------------------------------------
-- cl_enforce_form_a — the real authority for "which fields are required
-- for this route", mirroring cl_enforce_signoff()'s security-definer
-- pattern. The /new form validates the same rules client-side for a good
-- error message, but this trigger is what actually guarantees the data.
-- ------------------------------------------------------------
create or replace function public.cl_enforce_form_a()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route text;
  v_station text;
begin
  select route, station into v_route, v_station from cl_transactions where id = new.transaction_id;
  if v_route is null then
    raise exception 'CaterLink: transaction not found for Form A';
  end if;

  if v_route = 'VENDOR_SUPPLY' then
    if new.supplies_description is null or btrim(new.supplies_description) = '' then
      raise exception 'CaterLink: in-flight supplies (carts/containers/bins) is required on the Vendor Supplies Part A';
    end if;
  else
    if v_station is null or btrim(v_station) = '' then
      raise exception 'CaterLink: station is required on the IFCSF form';
    end if;
    if new.carts is null or new.smu is null or new.pallets is null or new.boxes is null or new.oven_rack is null then
      raise exception 'CaterLink: carts, SMU, pallets, boxes and oven rack counts are all required on IFCSF Part A';
    end if;
    if new.certifying_name is null or btrim(new.certifying_name) = '' then
      raise exception 'CaterLink: certifying staff name is required on IFCSF Part A';
    end if;
    if new.certifying_id is null or btrim(new.certifying_id) = '' then
      raise exception 'CaterLink: certifying staff ID is required on IFCSF Part A';
    end if;
  end if;

  if new.signature_url is null or btrim(new.signature_url) = '' then
    raise exception 'CaterLink: a signature is required on Part A';
  end if;

  return new;
end;
$$;

create trigger trg_cl_enforce_form_a
  before insert on public.cl_form_a
  for each row execute function public.cl_enforce_form_a();

revoke execute on function public.cl_enforce_form_a() from public, anon, authenticated;

-- ------------------------------------------------------------
-- RLS — same shape as cl_seals: read follows transaction visibility,
-- insert restricted to the transaction's own creator.
-- ------------------------------------------------------------
alter table public.cl_form_a enable row level security;

create policy "cl_form_a: read follows transaction visibility"
  on public.cl_form_a for select
  using (exists (select 1 from public.cl_transactions t where t.id = transaction_id));

create policy "cl_form_a: creator inserts own transaction's form A"
  on public.cl_form_a for insert
  with check (
    public.current_user_role() = any (array['warehouse_pic', 'driver_vendor'])
    and exists (
      select 1 from public.cl_transactions t
      where t.id = transaction_id and t.created_by = auth.uid()
    )
  );

-- ============================================================
-- For VECTA: cl_form_a.transaction_id is a clean 1:1 FK to
-- cl_transactions.id (unique, on delete cascade). Everything in this
-- table plus cl_transactions.station/cargo_types/vehicle_number and
-- cl_seals is the driver/warehouse side (Part A) already filled by
-- CaterLink — treat it as read-only, immutable history (an update/delete
-- trigger blocks writes from this side entirely). VECTA's own tables for
-- Part B (In-flight Security Post), Part C (Airport Security Post /
-- Warehouse for vendor), and Part D (Delivery Location) should reference
-- the same cl_transactions.id, not duplicate any Part A field captured
-- here.
-- ============================================================
