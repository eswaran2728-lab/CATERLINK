"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  error: string | null;
}

/**
 * Email + password sign-in, ported from icms-airasia's signIn action.
 * A pending/rejected registration (see registration.ts) is blocked here
 * even though requireProfile() double-checks it on every page load too —
 * this stops it before a session is ever handed back to the browser.
 */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Invalid email or password." };
  }

  const { data: profile } = await supabase.from("users").select("status").eq("id", data.user.id).single();

  if (profile?.status === "pending" || profile?.status === "rejected") {
    await supabase.auth.signOut();
    redirect(`/login?error=${profile.status}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}
