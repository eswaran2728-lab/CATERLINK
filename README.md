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

- **IFC drivers** — AirAsia staff. Role `driver_ifc`. Create ICMS
  inbound/outbound transactions. **Long-term**: Google Workspace SSO
  (`@airasia.com` only) — built (`src/app/auth/callback/route.ts`,
  `src/app/login/google-signin-button.tsx`) but not yet wired into
  `/login`, since Google OAuth isn't configured in Supabase yet.
  **For now**: same Driver Code + PIN login as vendor drivers, admin-issued
  via `scripts/create-ifc-driver.mjs` (no self-registration UI, matching
  VECTA's rule — this script is the only way to provision one currently).
- **Vendor drivers** — third-party, no email, permanent Driver Code + PIN.
  Issued by their vendor company's admin account (existing `vendor` role)
  from the `/admin/drivers` screen. Role `driver_vendor`. Create Vendor
  Movement Part A.

Both roles' Driver Code + PIN logins share one mechanism and one table
(`pin_drivers`) — see `src/lib/actions/pin-driver-auth.ts`. When Google
OAuth is ready, swap `driver_ifc` over to `GoogleSignInButton` on `/login`
and retire `create-ifc-driver.mjs`; nothing else changes, since the ICMS
transaction form/RLS only cares about the `driver_ifc` role, not how the
session was minted.

No AVSEC/office staff use CaterLink, and it has no scanning, reporting,
dashboard, or attendance features — those stay in VECTA.

### Whitelist

ICMS transactions hard-block any vehicle/driver not already registered
(active) in the `vehicles`/`drivers` tables, exactly like icms-airasia
today — CaterLink does not add a new registration path. An IFC driver
must already be on that whitelist (added via VECTA/admin) before they can
create a transaction here; the `staff_id` passed to
`create-ifc-driver.mjs` should match their whitelist entry.

## Migrations (on top of the already-applied ICMS + vendor_movement schema)

- `20260819000001_caterlink_driver_auth.sql` — adds the `driver_ifc`/
  `driver_vendor` roles and the `pin_drivers` table (Driver Code + bcrypt
  PIN, rate-limited, shared by both roles), plus RLS on
  `vendor_transactions`/`vendor_part_a` for the new roles.
- `20260819000002_caterlink_icms_driver.sql` — RLS on `transactions`/
  `part_a`/`seals` for `driver_ifc`, mirroring icms-airasia's `warehouse_pic`
  policies exactly (own-rows-only). No schema changes to those tables.

Never re-run or edit `20260813000002_vendor_movement.sql` — already
applied to the shared project.

## Screens

- `/login` — Driver Code + PIN (both driver types for now)
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

Provision an IFC driver (temporary, until Google OAuth is set up):

```bash
node scripts/create-ifc-driver.mjs "Ahmad Bin Ali" "WH-1001" [optional-4-digit-pin]
```

Google OAuth (later): enable the Google provider in Supabase Auth,
restrict it to the AirAsia Workspace domain, add
`https://<domain>/auth/callback` to the redirect allow-list, then swap
`driver_ifc` over to `GoogleSignInButton` on `/login`.
