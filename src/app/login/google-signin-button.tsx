"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: "airasia.com", prompt: "select_account" },
      },
    });
  }

  return (
    <Button type="button" size="xl" className="w-full" onClick={signIn} disabled={pending}>
      {pending ? "Redirecting…" : "Sign in with Google (AirAsia Workspace)"}
    </Button>
  );
}
