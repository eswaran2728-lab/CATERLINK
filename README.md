# CaterLink

Driver-facing app that only ever **generates** QR codes for two ICMS
movement types — it never scans them. AVSEC/warehouse staff scan the QR in
the separate **VECTA** app and continue the same downstream verification
workflow that already exists there; only the QR-creation step has moved
out of VECTA and into CaterLink.

1. **Vendor movement Part A** (form AA/SEC/F/019) — vendor drivers.
2. **ICMS inbound/outbound Part A** — AirAsia's own IFC catering drivers.
   Writes to the same `transactions`/`part_a`/`seals` tables VECTA's
   existing Part B/C/D verification flow already reads — same whitelist
   enforcement, same seal/cargo-type requirements, ported from
   `icms-airasia`'s `createTransaction`.

CaterLink and VECTA are separate Next.js deployments pointed at the same
Supabase project — no sync layer, they share tables directly. The
`QR_TOKEN_SECRET` env var must be byte-identical between the two apps or
QR scans fail signature verification (see `src/lib/qr-token.ts`).

## Who uses this

- **IFC drivers** — AirAsia staff, Google Workspace SSO (`@airasia.com`
  only). Role `driver_ifc`. Create ICMS inbound/outbound transactions.
- **Vendor drivers** — third-party, no email. Driver Code (`V-XXXX`) + 4-digit
  PIN, issued by their vendor company's admin account (existing `vendor`
  role) from the `/admin/drivers` screen. Role `driver_vendor`. Create
  Vendor Movement Part A.

No AVSEC/office staff use CaterLink, and it has no scanning, reporting,
dashboard, or attendance features — those stay in VECTA.

### Whitelist

ICMS transactions hard-block any vehicle/driver not already registered
(active) in the `vehicles`/`drivers` tables, exactly like icms-airasia
today — CaterLink does not add a new registration path. An IFC driver
must already be on the whitelist (added via VECTA/admin) before they can
create a transaction here.

## Migrations (on top of the already-applied ICMS + vendor_movement schema)

- `20260819000001_caterlink_driver_auth.sql` — adds the `driver_ifc`/
  `driver_vendor` roles, the `vendor_drivers` table (Driver Code + bcrypt
  PIN, rate-limited), and RLS on `vendor_transactions`/`vendor_part_a` for
  the new roles.
- `20260819000002_caterlink_icms_driver.sql` — RLS on `transactions`/
  `part_a`/`seals` for `driver_ifc`, mirroring icms-airasia's `warehouse_pic`
  policies exactly (own-rows-only). No schema changes to those tables.

Never re-run or edit `20260813000002_vendor_movement.sql` — already
applied to the shared project.

## Screens

- `/login` — AirAsia Staff (Google SSO) / Vendor Driver (Driver Code + PIN)
- `/` — New Delivery button + today's deliveries (role-scoped: ICMS
  `transactions` for `driver_ifc`, `vendor_transactions` for `driver_vendor`)
- `/new` — Part A form; branches by role between the ICMS transaction form
  (movement type, station, seals, cargo types, vehicle search) and the
  vendor Part A form (driver details, seal number, signature)
- `/[id]/qr` — full-screen QR pass with the reference number underneath
- `/[id]` — read-only status, live via Supabase Realtime once AVSEC/
  warehouse complete the next checkpoint
- `/admin/drivers` — vendor admin only: add/deactivate vendor drivers

## Setup

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
# SUPABASE_SERVICE_ROLE_KEY / QR_TOKEN_SECRET — same Supabase project and
# same QR_TOKEN_SECRET as VECTA.
npm install
npm run dev
```

Apply both `20260819000001_caterlink_driver_auth.sql` and
`20260819000002_caterlink_icms_driver.sql` to the shared Supabase project.

Google OAuth: enable the Google provider in Supabase Auth and restrict it
to the AirAsia Workspace domain (the app also checks the returned email
ends in `@airasia.com` after sign-in as defense in depth).
