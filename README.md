# CaterLink

Driver-facing app for the Vendor Movement Module (form AA/SEC/F/019), **Part
A only**: a driver fills in delivery details and CaterLink generates a
signed QR pass. AVSEC scans that QR in the separate **VECTA** app to
continue Part B (`post2_avsec`) and Part C (`warehouse_pic`).

CaterLink and VECTA are separate Next.js deployments pointed at the same
Supabase project — no sync layer, they share tables directly. The
`QR_TOKEN_SECRET` env var must be byte-identical between the two apps or
QR scans fail signature verification (see `src/lib/qr-token.ts`).

## Who uses this

- **IFC drivers** — AirAsia staff, Google Workspace SSO (`@airasia.com`
  only). Role `driver_ifc`.
- **Vendor drivers** — third-party, no email. Driver Code (`V-XXXX`) + 4-digit
  PIN, issued by their vendor company's admin account (existing `vendor`
  role) from the `/admin/drivers` screen. Role `driver_vendor`.

Both roles create Vendor Movement Part A exactly like icms-airasia's
original `vendor` role did — see
`supabase/migrations/20260819000001_caterlink_driver_auth.sql`, which adds
the two new roles and RLS policies on top of the already-applied
`20260813000002_vendor_movement.sql` (shared with VECTA — never re-run or
edit that file).

## Screens

- `/login` — AirAsia Staff (Google SSO) / Vendor Driver (Driver Code + PIN)
- `/` — New Delivery button + today's deliveries
- `/new` — Part A form (driver details, seal number, signature)
- `/[id]/qr` — full-screen QR pass with the reference number underneath
- `/[id]` — read-only status, live via Supabase Realtime once AVSEC/warehouse
  complete Part B/C
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

Apply `supabase/migrations/20260819000001_caterlink_driver_auth.sql` to the
shared Supabase project (the other migration in this repo is already
applied — do not re-run it).

Google OAuth: enable the Google provider in Supabase Auth and restrict it
to the AirAsia Workspace domain (the app also checks the returned email
ends in `@airasia.com` after sign-in as defense in depth).
