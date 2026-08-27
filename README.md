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

Both driver types **self-register** on `/register` with whatever email
they already use — no domain restriction, no admin-issued codes. This is
icms-airasia's existing pattern (`src/lib/actions/registration.ts`,
ported): a real Supabase Auth account is created immediately, but the
profile starts `status='pending'` and can't sign in
(`src/lib/actions/auth-session.ts`'s `signIn`) until a **VECTA admin**
(`supervisor` role) approves it from **VECTA's own admin panel** — there
is no separate approval screen in CaterLink.

- **IFC drivers** — AirAsia staff. Role `driver_ifc`. Create ICMS
  inbound/outbound transactions. Register with their ICMS whitelist staff
  ID as the "Staff / Driver ID" field.
- **Vendor drivers** — third-party. Role `driver_vendor`. Create Vendor
  Movement Part A.

No AVSEC/office staff use CaterLink, and it has no scanning, reporting,
dashboard, or attendance features — those stay in VECTA.

Google Workspace SSO for `driver_ifc` was scaffolded
(`src/app/auth/callback/route.ts`, `src/app/login/google-signin-button.tsx`)
but isn't wired into `/login` — Google OAuth isn't configured in Supabase
yet. Self-registration works today regardless; swapping in Google SSO
later is optional, not a blocker.

### Whitelist

ICMS transactions hard-block any vehicle/driver not already registered
(active) in the `vehicles`/`drivers` tables, exactly like icms-airasia
today — registering a CaterLink account does not add anyone to that
whitelist. An IFC driver must already be on it (added via VECTA/admin)
before they can create a transaction here; the "Staff / Driver ID" they
register with should match their whitelist entry exactly.

## Migrations (on top of the already-applied ICMS + vendor_movement schema)

- `20260819000001_caterlink_driver_auth.sql` — adds the `driver_ifc`/
  `driver_vendor` roles and RLS on `vendor_transactions`/`vendor_part_a`
  for them (own-rows-only, mirroring the existing `vendor` policies).
- `20260819000002_caterlink_icms_driver.sql` — RLS on `transactions`/
  `part_a`/`seals` for `driver_ifc`, mirroring icms-airasia's `warehouse_pic`
  policies exactly. No schema changes to those tables.
- `20260819000003_drop_pin_drivers.sql` — drops the `pin_drivers` table
  from an earlier Driver Code + PIN design, superseded by plain
  self-registration. Safe no-op if that table was never created.

Never re-run or edit `20260813000002_vendor_movement.sql` — already
applied to the shared project.

## Screens

- `/register` — driver self-registration (name, staff/driver ID, email,
  role, password) → `status='pending'` until a VECTA admin approves
- `/login` — email + password
- `/` — New Delivery button + today's deliveries (role-scoped: ICMS
  `transactions` for `driver_ifc`, `vendor_transactions` for `driver_vendor`)
- `/new` — Part A form; branches by role between the ICMS transaction form
  (movement type, station, seals, cargo types, vehicle search) and the
  vendor Part A form (driver details, seal number, signature)
- `/[id]/qr` — full-screen QR pass with the reference number underneath
- `/[id]` — read-only status, live via Supabase Realtime once AVSEC/
  warehouse complete the next checkpoint

## Setup

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
# SUPABASE_SERVICE_ROLE_KEY / QR_TOKEN_SECRET — same Supabase project and
# same QR_TOKEN_SECRET as VECTA.
npm install
npm run dev
```

Apply all three CaterLink migrations (`20260819000001` through
`20260819000003`) to the shared Supabase project, then register a driver
at `/register` and have a VECTA admin approve it from VECTA's admin
panel before testing sign-in.

Google OAuth (optional, later): enable the Google provider in Supabase
Auth, restrict it to the AirAsia Workspace domain, add
`https://<domain>/auth/callback` to the redirect allow-list, then swap
`driver_ifc` over to `GoogleSignInButton` on `/login`.
