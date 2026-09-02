-- ============================================================
-- CaterLink's QR-mint flow calls VECTA's /api/icms/qr/mint endpoint and
-- then needs to persist the returned token onto the row it just created.
-- Neither transactions nor vendor_transactions has an UPDATE RLS policy
-- for the creator role, so that write was silently no-op'd (RLS blocks
-- it, no error surfaced) — the QR still rendered because the minted
-- token was used in-memory, but qr_token stayed null in the DB and every
-- page view re-minted from scratch instead of reusing a cached token.
--
-- Fixed with narrow security-definer RPCs (same pattern as
-- cl_cancel_transaction) rather than a raw UPDATE policy, so the write
-- is limited to exactly the qr_token column, only by the row's own
-- creator, only while status = 'CREATED'.
-- ============================================================

create or replace function public.set_transaction_qr_token(p_transaction_id uuid, p_qr_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
  v_status text;
begin
  select created_by, status into v_created_by, v_status
  from transactions where id = p_transaction_id for update;

  if v_created_by is null then
    raise exception 'CaterLink: transaction not found';
  end if;
  if v_created_by <> auth.uid() then
    raise exception 'CaterLink: not authorized to set the QR token for this transaction';
  end if;
  if v_status <> 'CREATED' then
    raise exception 'CaterLink: transaction is already %, cannot set QR token', v_status;
  end if;
  if p_qr_token is null or btrim(p_qr_token) = '' then
    raise exception 'CaterLink: qr token must not be empty';
  end if;

  update transactions set qr_token = p_qr_token where id = p_transaction_id;
end;
$$;

revoke all on function public.set_transaction_qr_token(uuid, text) from public, anon;
grant execute on function public.set_transaction_qr_token(uuid, text) to authenticated;

create or replace function public.set_vendor_transaction_qr_token(p_transaction_id uuid, p_qr_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
  v_status text;
begin
  select created_by, status into v_created_by, v_status
  from vendor_transactions where id = p_transaction_id for update;

  if v_created_by is null then
    raise exception 'CaterLink: vendor transaction not found';
  end if;
  if v_created_by <> auth.uid() then
    raise exception 'CaterLink: not authorized to set the QR token for this vendor transaction';
  end if;
  if v_status <> 'CREATED' then
    raise exception 'CaterLink: vendor transaction is already %, cannot set QR token', v_status;
  end if;
  if p_qr_token is null or btrim(p_qr_token) = '' then
    raise exception 'CaterLink: qr token must not be empty';
  end if;

  update vendor_transactions set qr_token = p_qr_token where id = p_transaction_id;
end;
$$;

revoke all on function public.set_vendor_transaction_qr_token(uuid, text) from public, anon;
grant execute on function public.set_vendor_transaction_qr_token(uuid, text) to authenticated;
