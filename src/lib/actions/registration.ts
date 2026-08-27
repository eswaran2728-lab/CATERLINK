"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/database.types";

export interface RegisterState {
  error: string | null;
  success: string | null;
}

/** CaterLink only ever registers the two driver roles — never vendor/warehouse_pic/etc. */
const REGISTERABLE_ROLES: Role[] = ["driver_ifc", "driver_vendor"];

/**
 * Public: driver self-registration, ported from icms-airasia's
 * registerStaff. Creates a real Supabase Auth account right away (any
 * email the driver already uses — no domain/whitelist restriction here)
 * but the profile is inserted with status='pending', which blocks
 * sign-in (enforced in auth-session.ts's signIn) until a VECTA admin
 * (supervisor role) approves it from VECTA's existing admin panel — no
 * separate approval screen in CaterLink.
 */
export async function registerStaff(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const name = String(formData.get("name") ?? "").trim();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;
  const password = String(formData.get("password") ?? "");

  if (!name || !staffId || !email) {
    return { error: "Name, staff/driver ID and email are required.", success: null };
  }
  if (!REGISTERABLE_ROLES.includes(role)) {
    return { error: "Select whether you're an IFC driver or a vendor driver.", success: null };
  }
  if (password.length < 10) {
    return { error: "Password must be at least 10 characters.", success: null };
  }

  const admin = createAdminClient();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !created.user) {
    return { error: authError?.message ?? "Could not create account.", success: null };
  }

  const { error: profileError } = await admin.from("users").insert({
    id: created.user.id,
    name,
    staff_id: staffId,
    email,
    role,
    status: "pending",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `Registration could not be saved: ${profileError.message}`, success: null };
  }

  return {
    error: null,
    success:
      "Registration submitted. A VECTA admin must approve your account before you can sign in — " +
      "you'll be able to log in once that's done.",
  };
}
