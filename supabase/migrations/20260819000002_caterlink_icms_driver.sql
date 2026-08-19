-- ============================================================
-- CaterLink: let driver_ifc drivers create ICMS inbound/outbound
-- transactions (`transactions` + `part_a`) directly from CaterLink,
-- alongside icms-airasia's existing warehouse_pic path. driver_ifc was
-- already added to users_role_check by
-- 20260819000001_caterlink_driver_auth.sql; this migration only adds
-- the matching RLS, mirroring "transactions: warehouse reads own" /
-- "transactions: warehouse creates" / "part_a: warehouse inserts own"
-- from icms-airasia's 20260101000002_rls.sql exactly, own-rows-only,
-- for the new role. No schema change to `transactions`/`part_a`
-- themselves — CaterLink writes the exact same columns createTransaction
-- always has, so VECTA's Part B/C/D verification flow is unaffected.
--
-- enforce_whitelist_on_create() (20260810000001_strict_whitelist.sql)
-- and the seal/cargo-type NOT NULL constraints already apply
-- role-agnostically to every insert on `transactions`, so a driver_ifc
-- driver is held to the exact same whitelist/seal requirements as
-- warehouse_pic today — nothing to add here for that.
-- ============================================================

create policy "transactions: driver_ifc reads own"
  on public.transactions for select
  using (
    public.current_user_role() = 'driver_ifc' and created_by = auth.uid()
  );

create policy "transactions: driver_ifc creates"
  on public.transactions for insert
  with check (
    public.current_user_role() = 'driver_ifc'
    and created_by = auth.uid()
    and status = 'CREATED'
  );

create policy "part_a: driver_ifc inserts own"
  on public.part_a for insert
  with check (
    public.current_user_role() = 'driver_ifc'
    and completed_by = auth.uid()
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.created_by = auth.uid()
    )
  );

-- seals: read follows transaction visibility (existing policy already
-- cascades to driver_ifc via the transactions SELECT policy above).
-- Insert policy mirrors part_a — the seals a driver_ifc driver just
-- created belong to a transaction they own.
create policy "seals: driver_ifc inserts own transaction's seals"
  on public.seals for insert
  with check (
    public.current_user_role() = 'driver_ifc'
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.created_by = auth.uid()
    )
  );
