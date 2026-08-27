-- Security advisor flagged cl_next_reference_number()/cl_set_reference_number()
-- as directly callable via RPC by anon/authenticated — no legitimate
-- client ever needs to call them outside the BEFORE INSERT trigger.
-- Revoking execute doesn't break the trigger itself (Postgres triggers
-- run with the function owner's privileges regardless of the invoking
-- role's own EXECUTE grant — same pattern already used for
-- enforce_vendor_part_sequence()/cl_enforce_signoff()).
revoke execute on function public.cl_next_reference_number() from public, anon, authenticated;
revoke execute on function public.cl_set_reference_number() from public, anon, authenticated;
