# CaterLink tests

## Unit tests (`tests/unit/`)

Run with `npm test` (or `npx vitest run`). These cover the pure logic
extracted from the client forms and server actions:

- `form-validation.test.ts` — the `/new` submit-button validation summary
  (item: checkbox state / "Select at least one" fix).
- `seal-parsing.test.ts` — seal-draft JSON parsing and the whitelist
  driver-name comparison, for all 6 movement types' shared validation path.
- `whitelist-message.test.ts` — the whitelist-rejection message builder.
- `route-signoff-mapping.test.ts` — asserts `ROUTE_SIGNOFF_ROLE` (app-side)
  stays identical to the Postgres trigger's hardcoded mapping, so the two
  can't silently drift apart.

## Database trigger verification (not run in CI — see below)

The real authority for sign-off role-matching is the `cl_enforce_signoff()`
Postgres trigger and, for cancellation, `cl_cancel_transaction()` — both in
`supabase/migrations/`. There's no local Postgres/pgTAP harness wired into
this repo yet, so their live behavior was verified directly against the
`vecta-prod` database via the Supabase MCP tools, inside `BEGIN; ... ROLLBACK;`
blocks so no test data was left behind. Two runs:

1. **`cl_cancel_transaction`**: inserted a `CREATED` transaction as the
   `warehouse_pic` test user, cancelled it as that same user (succeeded,
   `status` -> `CANCELLED`), then attempted to cancel a different user's
   transaction as an unrelated `driver_vendor` account (rejected with
   `CaterLink: not authorized to cancel this transaction`).
2. **`cl_enforce_signoff`**: inserted a `STANDARD_OUTBOUND` transaction
   (requires `receiver`), attempted sign-off as `hub_avsec` (rejected with
   `CaterLink: route % must be signed off by %`), then signed off as
   `receiver` (succeeded, `status` -> `COMPLETED`).

Both runs confirmed zero residual rows afterward (`ROLLBACK` fully undid
the inserts). To make this repeatable in CI, wire up `supabase test db`
(pgTAP) or point the Supabase CLI at a local/branch database and script the
same two scenarios — that wasn't possible in this sandbox since it has no
Docker/local Postgres access.
