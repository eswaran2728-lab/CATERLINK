# CaterLink

CaterLink creates transactions and generates QR codes; **VECTA** is where
AVSEC scans them at physical checkpoints (Post 2, Post 6, REDQ, Hub,
Receiver) to process security clearance. A transaction starts in
CaterLink, crosses into VECTA for checkpoint scanning as it physically
moves, and returns to CaterLink one final time at whichever checkpoint
is its actual last stop — where it's signed off and both parties get a
completion PDF.

Built independently of VECTA — no VECTA code or tables are reused.
CaterLink shares the same Supabase project (so both apps can see the
same transaction and the same user accounts) but has its own fresh
tables (`cl_transactions`, `cl_seals`, `cl_signoffs`), not
icms-airasia's `transactions`/`vendor_transactions`/`part_a`/`seals`,
which VECTA keeps using unchanged for its own workflow.

**The QR payload format is provisional** — not yet agreed with VECTA's
team. See `docs/qr-payload-proposal.md`, which is the document to hand
them before treating this as final.

## Roles (no new roles — reuses existing VECTA accounts directly)

- **`warehouse_pic`** — creates the standard/aircraft/hub/REDQ/
  maintenance/inbound transaction (the "IFC AVSEC Staff" creator role
  in the handoff spec). Same account as VECTA's existing warehouse PIC.
- **`driver_vendor`** — third-party vendor driver, creates Vendor
  Supply transactions. The only role that self-registers via CaterLink
  (`/register`) — every other role below already has a VECTA account
  and signs in directly with those same credentials (same Supabase Auth
  project, so no separate CaterLink login exists for them).
- **`post2_avsec`**, **`post6_avsec`**, **`hub_avsec`**, **`receiver`** —
  sign off in CaterLink at whichever checkpoint is a given route's
  actual last stop:

  | Route | Signs off as |
  |---|---|
  | Vendor Supply | `post2_avsec` |
  | Maintenance | `post6_avsec` |
  | Hub-bound | `hub_avsec` |
  | Standard/Aircraft Outbound, REDQ, Inbound | `receiver` |

`driver_vendor` registration keeps icms-airasia's existing self-register
+ `status='pending'` + VECTA-admin-approves pattern
(`src/lib/actions/registration.ts`) — a VECTA admin (`supervisor`)
approves from VECTA's own admin panel, no separate approval screen here.

## Transaction lifecycle

Two states only — VECTA owns everything in between:

1. **CREATED** — transaction + QR generated in CaterLink. Checkpoint
   scanning happens entirely in VECTA; CaterLink is not involved again
   until the last checkpoint.
2. **COMPLETED** — the matching role (table above) signs off in
   CaterLink with a captured signature. This generates a completion PDF,
   downloadable in-app by both the creator and the signer from the
   transaction's status page (`/[id]`) — no email sending is set up.

## Migrations

- `20260813000002_vendor_movement.sql`, `20260819000001`–`000003` —
  CaterLink v1 (superseded, kept for history — never re-run).
- `20260819000004_caterlink_v2_schema.sql` — the current schema.
  Creates `cl_transactions`/`cl_seals`/`cl_signoffs`, removes `driver_ifc`
  from `users_role_check` (and the one test row that had it), and drops
  the now-dead v1 RLS policies on the legacy `transactions`/`part_a`/
  `seals`/`vendor_transactions`/`vendor_part_a` tables — those tables
  themselves, and VECTA/icms-airasia's own policies on them, are
  untouched.

## Screens

- `/register` — vendor driver self-registration only.
- `/login` — email + password (works for any existing VECTA account
  too, same Supabase Auth project).
- `/` — creators (`warehouse_pic`/`driver_vendor`) see a "+ New
  Delivery" button and their transactions; signer roles see all
  transactions with a "needs your sign-off" highlight.
- `/new` — branches by role: detailed form (movement type, seals,
  cargo types, vehicle-search checkbox, whitelist check against the
  shared `vehicles`/`drivers` tables) for `warehouse_pic`; simple form
  (driver name, NRIC, one seal) for `driver_vendor`.
- `/[id]` — status, seals, and (once completed) sign-off details + PDF
  download.
- `/[id]/qr` — full-screen QR pass.
- `/[id]/signoff` — visible only to the role required by the
  transaction's route, only while `CREATED`.

## Setup

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
# SUPABASE_SERVICE_ROLE_KEY (same Supabase project as VECTA) and
# CATERLINK_QR_SECRET (own value — see docs/qr-payload-proposal.md).
npm install
npm run dev
```

Apply `20260819000004_caterlink_v2_schema.sql` to the shared Supabase
project. Hand `docs/qr-payload-proposal.md` to VECTA's team — until
they confirm and wire their scanner to look up `cl_transactions`, the
two systems are not actually connected for the scan/sign-off relay.
