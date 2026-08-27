# CaterLink → VECTA QR Payload — PROVISIONAL PROPOSAL

> **Status: PROVISIONAL — not yet agreed with VECTA's team.** Per the
> handoff spec, this format must be jointly confirmed before either side
> builds against it as final. CaterLink's implementation
> (`src/lib/cl-qr-token.ts`) is ready to adapt if VECTA's team wants
> changes.

## What CaterLink encodes

The QR code's raw payload is a JSON object:

```json
{ "t": "CL.<transactionId>.<expiryUnixSeconds>.<hmacSignature>" }
```

The `t` value ("token") breaks down as:

| Segment | Example | Meaning |
|---|---|---|
| `CL` | `CL` | Fixed prefix identifying this as a CaterLink v2 token (distinct from icms-airasia's own `CATERING`/`VENDOR` token types, which VECTA continues to issue and validate separately for its own workflow) |
| transaction id | `a1b2c3d4-...` | The `cl_transactions.id` UUID |
| expiry | `1787990400` | Unix seconds; token is valid 24 hours from issue |
| signature | `Xy12...` | `HMAC-SHA256("CL.<id>.<expiry>", secret)`, base64url-encoded |

## What VECTA's scanner needs to do

1. Scan the QR, parse the JSON, split `t` on `.` — expect exactly 4 parts
   with the first equal to `CL`.
2. Recompute the HMAC over `CL.<id>.<expiry>` using the **shared secret**
   (see below) and compare to the 4th segment with a constant-time
   comparison. Reject on mismatch — this is the only thing preventing a
   forged or altered QR from being accepted.
3. Reject if `expiry` has passed.
4. Look up the transaction by `id` in **`public.cl_transactions`**
   (same Supabase project, new table — not the existing `transactions`/
   `vendor_transactions` tables). Read `route` to know which of VECTA's
   existing checkpoint flows applies.
5. Process the checkpoint scan entirely within VECTA as today — CaterLink
   is not involved again until the transaction reaches its actual last
   checkpoint (see the route → signing-role table below), at which point
   the driver shows the same QR one more time and the AVSEC officer signs
   off inside **CaterLink**, not VECTA.

## Route → who signs off (in CaterLink, not VECTA)

Reusing VECTA's existing role names directly — no new roles were
introduced for this:

| `cl_transactions.route` | Signs off in CaterLink as |
|---|---|
| `VENDOR_SUPPLY` | `post2_avsec` |
| `MAINTENANCE` | `post6_avsec` |
| `HUB` | `hub_avsec` |
| `STANDARD_OUTBOUND`, `AIRCRAFT_OUTBOUND`, `REDQ`, `INBOUND` | `receiver` |

## The shared secret

`CATERLINK_QR_SECRET` — a new, independent value (NOT the same as
icms-airasia's existing `QR_TOKEN_SECRET`, which stays scoped to VECTA's
own token type). Once VECTA's team confirms this format, the exact same
secret value must be set in both CaterLink's and VECTA's environment
variables, or signature verification will fail on every scan.

## Open questions for VECTA's team

1. Does VECTA's scanner need any additional fields in the payload (e.g.
   `route` inline, so it doesn't need a DB lookup before deciding which
   flow to run)?
2. Confirm `cl_transactions` is reachable from VECTA's backend — same
   Supabase project, RLS already grants read access to
   `post2_avsec`/`post6_avsec`/`hub_avsec`/`receiver`/`supervisor`/
   `enforcement` (see `20260819000004_caterlink_v2_schema.sql`).
3. Confirm the 24-hour TTL is acceptable, or specify a different value.
