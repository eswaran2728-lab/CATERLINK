"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import type { VendorDriver } from "@/lib/database.types";

export interface ActionState {
  error: string | null;
}

const PIN_RE = /^\d{4}$/;
const MAX_PIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/** Every vendor driver's Supabase Auth user lives under this fake domain — see the migration. */
function internalEmail(driverCode: string): string {
  return `${driverCode.toLowerCase()}@vendor.caterlink.internal`;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Driver Code + PIN login for third-party vendor drivers (no email).
 * Verifies the PIN with the service-role client (no session exists yet),
 * rate-limits attempts, then mints a real passwordless Supabase Auth
 * session for the driver's own auth.users row via a magic-link OTP
 * exchange — so auth.uid() and RLS work exactly like any other signed-in
 * user from here on.
 */
export async function loginVendorDriver(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const driverCode = str(formData, "driver_code").toUpperCase();
  const pin = str(formData, "pin");

  if (!driverCode) return { error: "Enter your Driver Code." };
  if (!PIN_RE.test(pin)) return { error: "PIN must be 4 digits." };

  const admin = createAdminClient();
  const { data: driver } = await admin
    .from("vendor_drivers")
    .select("*")
    .eq("driver_code", driverCode)
    .maybeSingle();

  if (!driver) {
    return { error: "Driver Code not found. / Kod Pemandu tidak dijumpai." };
  }
  const d = driver as VendorDriver;

  if (!d.is_active) {
    return { error: "This driver account has been deactivated. Contact your vendor admin." };
  }

  if (d.locked_until && new Date(d.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(d.locked_until).getTime() - Date.now()) / 60000);
    return { error: `Too many attempts. Try again in ${minutesLeft} minute(s).` };
  }

  const valid = await bcrypt.compare(pin, d.pin_hash);
  if (!valid) {
    const attempts = d.failed_pin_attempts + 1;
    const lockedOut = attempts >= MAX_PIN_ATTEMPTS;
    await admin
      .from("vendor_drivers")
      .update({
        failed_pin_attempts: lockedOut ? 0 : attempts,
        locked_until: lockedOut
          ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
          : null,
      })
      .eq("id", d.id);

    return lockedOut
      ? { error: `Too many incorrect PIN attempts. Locked for ${LOCK_MINUTES} minutes.` }
      : { error: `Incorrect PIN (${MAX_PIN_ATTEMPTS - attempts} attempt(s) left).` };
  }

  if (d.failed_pin_attempts > 0 || d.locked_until) {
    await admin
      .from("vendor_drivers")
      .update({ failed_pin_attempts: 0, locked_until: null })
      .eq("id", d.id);
  }

  const email = internalEmail(d.driver_code);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link) {
    return { error: "Could not start session. Please try again." };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
    email,
  });
  if (verifyError) {
    return { error: "Could not start session. Please try again." };
  }

  redirect("/");
}

/**
 * Vendor-admin ('vendor' role) registers a new driver: creates the
 * driver's passwordless Supabase Auth user, their public.users profile
 * (role driver_vendor), and the vendor_drivers row with the PIN the
 * admin chose (hashed, never stored in plaintext). The Driver Code is
 * generated server-side; hand it to the driver out of band along with
 * the PIN.
 */
export async function createVendorDriver(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireRole(["vendor"]);

  const fullName = str(formData, "full_name");
  const icNumber = str(formData, "ic_number");
  const phone = str(formData, "phone");
  const vehiclePlate = str(formData, "vehicle_plate");
  const pin = str(formData, "pin");

  if (!fullName || !icNumber) {
    return { error: "Driver name and IC number are required." };
  }
  if (!PIN_RE.test(pin)) {
    return { error: "PIN must be exactly 4 digits." };
  }

  const admin = createAdminClient();

  const { data: codeData, error: codeError } = await admin.rpc("next_driver_code");
  if (codeError || !codeData) {
    return { error: `Could not generate a Driver Code: ${codeError?.message ?? "unknown error"}` };
  }
  const driverCode = codeData as string;
  const email = internalEmail(driverCode);

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID() + crypto.randomUUID(),
    user_metadata: { driver_code: driverCode, kind: "vendor_driver" },
  });
  if (authError || !authUser.user) {
    return { error: `Could not create driver login: ${authError?.message ?? "unknown error"}` };
  }

  const { error: userError } = await admin.from("users").insert({
    id: authUser.user.id,
    name: fullName,
    staff_id: driverCode,
    email,
    role: "driver_vendor",
    status: "active",
  });
  if (userError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { error: `Could not create driver profile: ${userError.message}` };
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const { error: driverError } = await admin.from("vendor_drivers").insert({
    id: authUser.user.id,
    vendor_id: profile.id,
    driver_code: driverCode,
    pin_hash: pinHash,
    full_name: fullName,
    ic_number: icNumber,
    phone: phone || null,
    vehicle_plate: vehiclePlate || null,
  });
  if (driverError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { error: `Could not save driver: ${driverError.message}` };
  }

  revalidatePath("/admin/drivers");
  redirect(`/admin/drivers?created=${driverCode}`);
}

/** Vendor-admin toggles a driver's is_active flag without deleting their history. */
export async function setVendorDriverActive(driverId: string, isActive: boolean): Promise<void> {
  const profile = await requireRole(["vendor"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("vendor_drivers")
    .update({ is_active: isActive })
    .eq("id", driverId)
    .eq("vendor_id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/drivers");
}
