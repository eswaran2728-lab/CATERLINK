import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Google Workspace SSO callback for IFC (AirAsia staff) drivers. Exchanges
 * the OAuth code for a session, then lazily creates the matching
 * public.users profile (role driver_ifc) on first sign-in — Google Auth
 * only creates the auth.users row, never our app profile.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const email = data.user.email ?? "";
  if (!email.toLowerCase().endsWith("@airasia.com")) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("users").select("id").eq("id", data.user.id).maybeSingle();

  if (!existing) {
    const { error: insertError } = await admin.from("users").insert({
      id: data.user.id,
      name: data.user.user_metadata?.full_name ?? email.split("@")[0],
      staff_id: email.split("@")[0],
      email,
      role: "driver_ifc",
      status: "active",
    });
    if (insertError) {
      return NextResponse.redirect(`${origin}/login?error=profile`);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
