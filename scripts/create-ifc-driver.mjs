/**
 * Temporary IFC driver provisioning, until Google Workspace SSO is
 * configured for driver_ifc (see src/app/auth/callback/route.ts and
 * src/app/login/google-signin-button.tsx, not yet wired into /login).
 *
 * Creates the driver's passwordless Supabase Auth user, their
 * public.users profile (role driver_ifc), and a pin_drivers row with a
 * server-generated Driver Code (I-XXXX) and the PIN you choose (hashed
 * — never stored in plaintext). No self-registration UI exists for
 * driver_ifc by design (see 20260819000001_caterlink_driver_auth.sql)
 * — this script is the only way to provision one for now. Hand the
 * printed Driver Code + PIN to the driver out of band.
 *
 * Usage:
 *   node scripts/create-ifc-driver.mjs "Ahmad Bin Ali" "WH-1001" [pin]
 * `staff_id` should match the driver's existing ICMS whitelist entry
 * (public.drivers.staff_id) — CaterLink's ICMS form still enforces that
 * whitelist match at transaction-creation time regardless of how the
 * driver signed in.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from env or
 * .env.local (same as icms-airasia's scripts/seed.mjs).
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in env or .env.local) first."
  );
  process.exit(1);
}

const [fullName, staffId, pinArg] = process.argv.slice(2);
if (!fullName || !staffId) {
  console.error('Usage: node scripts/create-ifc-driver.mjs "Full Name" "STAFF-ID" [4-digit-pin]');
  process.exit(1);
}

const pin = pinArg ?? String(Math.floor(1000 + Math.random() * 9000));
if (!/^\d{4}$/.test(pin)) {
  console.error("PIN must be exactly 4 digits.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: codeData, error: codeError } = await admin.rpc("next_driver_code", {
    p_role: "driver_ifc",
  });
  if (codeError || !codeData) {
    console.error("Could not generate a Driver Code:", codeError?.message ?? "unknown error");
    process.exit(1);
  }
  const driverCode = codeData;
  const email = `${driverCode.toLowerCase()}@ifc.caterlink.internal`;

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID() + crypto.randomUUID(),
    user_metadata: { driver_code: driverCode, kind: "ifc_driver" },
  });
  if (authError || !authUser.user) {
    console.error("Could not create driver login:", authError?.message ?? "unknown error");
    process.exit(1);
  }

  const { error: userError } = await admin.from("users").insert({
    id: authUser.user.id,
    name: fullName,
    staff_id: staffId,
    email,
    role: "driver_ifc",
    status: "active",
  });
  if (userError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    console.error("Could not create driver profile:", userError.message);
    process.exit(1);
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const { error: driverError } = await admin.from("pin_drivers").insert({
    id: authUser.user.id,
    driver_role: "driver_ifc",
    vendor_id: null,
    driver_code: driverCode,
    pin_hash: pinHash,
    full_name: fullName,
    ic_number: null,
    staff_id: staffId,
    phone: null,
    vehicle_plate: null,
  });
  if (driverError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    console.error("Could not save driver:", driverError.message);
    process.exit(1);
  }

  console.log(`IFC driver created: ${fullName} (${staffId})`);
  console.log(`  Driver Code: ${driverCode}`);
  console.log(`  PIN:         ${pin}`);
  console.log("Hand these to the driver out of band — they will not be shown again.");
}

main();
