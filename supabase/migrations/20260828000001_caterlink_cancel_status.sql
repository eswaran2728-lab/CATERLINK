-- ============================================================
-- CaterLink: add a CANCELLED terminal status for cl_transactions
-- (failed vehicle search, vendor no-show, etc). Mirrors the existing
-- cl_enforce_signoff() pattern: a security-definer function is the real
-- authority for the transition, not a client-facing UPDATE policy, so
-- a client can never smuggle other column changes through a cancel.
-- ============================================================

alter table public.cl_transactions
  drop constraint cl_transactions_status_check;

alter table public.cl_transactions
  add constraint cl_transactions_status_check
  check (status in ('CREATED', 'COMPLETED', 'CANCELLED'));

alter table public.cl_transactions
  add column cancelled_at timestamptz,
  add column cancelled_reason text,
  add column cancelled_by uuid references public.users (id);

create or replace function public.cl_cancel_transaction(p_transaction_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_created_by uuid;
  v_role text := public.current_user_role();
begin
  select status, created_by into v_status, v_created_by
  from cl_transactions where id = p_transaction_id for update;

  if v_status is null then
    raise exception 'CaterLink: transaction not found';
  end if;
  if v_status <> 'CREATED' then
    raise exception 'CaterLink: transaction is already %, cannot cancel', v_status;
  end if;

  if not (
    (v_created_by = auth.uid() and v_role = any (array['warehouse_pic', 'driver_vendor']))
    or v_role = 'supervisor'
  ) then
    raise exception 'CaterLink: not authorized to cancel this transaction';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'CaterLink: a cancellation reason is required';
  end if;

  update cl_transactions
  set status = 'CANCELLED', cancelled_at = now(), cancelled_reason = btrim(p_reason), cancelled_by = auth.uid()
  where id = p_transaction_id;
end;
$$;

revoke all on function public.cl_cancel_transaction(uuid, text) from public, anon;
grant execute on function public.cl_cancel_transaction(uuid, text) to authenticated;
