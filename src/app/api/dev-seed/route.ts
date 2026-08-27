import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * TEMPORARY one-time test-account provisioning. Creates a warehouse_pic
 * and a receiver account (neither self-registers via CaterLink — only
 * driver_vendor does) so the full create -> sign-off flow can be tested
 * end-to-end. Gated by DEV_SEED_TOKEN. DELETE THIS FILE after using it
 * once — it is not meant to ship to production.
 */
const DEV_SEED_TOKEN = "ed629919d0028642d9256b98dc24d887";

const TEST_ACCOUNTS = [
  { role: "warehouse_pic", email: "test-warehouse-pic@caterlink.internal", name: "Test Warehouse PIC", staffId: "TEST-WH-001" },
  { role: "receiver", email: "test-receiver@caterlink.internal", name: "Test Receiver", staffId: "TEST-RCV-001" },
] as const;

function html(body: string) {
  return new NextResponse(
    `<!doctype html><html><body style="font-family:monospace;white-space:pre-wrap;padding:2rem;font-size:16px;">${body}</body></html>`,
    { headers: { "content-type": "text/html" } }
  );
}

function randomPassword(): string {
  return "Test-" + Math.random().toString(36).slice(2, 10) + "-2026!";
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== DEV_SEED_TOKEN) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createAdminClient();
  const lines: string[] = [];

  for (const account of TEST_ACCOUNTS) {
    const { data: existing } = await admin.from("users").select("id").eq("email", account.email).maybeSingle();
    if (existing) {
      lines.push(`${account.role} test account already exists (${account.email}) — password unknown (not re-shown).`);
      lines.push("");
      continue;
    }

    const password = randomPassword();
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: account.email,
      email_confirm: true,
      password,
    });
    if (authError || !authUser.user) {
      lines.push(`Error creating ${account.role}: ${authError?.message ?? "unknown error"}`);
      lines.push("");
      continue;
    }

    const { error: profileError } = await admin.from("users").insert({
      id: authUser.user.id,
      name: account.name,
      staff_id: account.staffId,
      email: account.email,
      role: account.role,
      status: "active",
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      lines.push(`Error saving ${account.role} profile: ${profileError.message}`);
      lines.push("");
      continue;
    }

    lines.push(`${account.role} test account created:`);
    lines.push(`  Email:    ${account.email}`);
    lines.push(`  Password: ${password}`);
    lines.push("");
  }

  lines.push("Sign in at /login with either account above.");
  lines.push("Note: whitelist-checked transaction creation still needs a real vehicle/driver");
  lines.push("registered in the vehicles/drivers tables to actually succeed.");
  lines.push("DELETE src/app/api/dev-seed/route.ts now that you've used it.");

  return html(lines.join("\n"));
}
