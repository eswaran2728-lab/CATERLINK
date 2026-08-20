"use client";

// Not wired into /login yet — Google OAuth isn't configured in Supabase.
// IFC drivers use the Driver Code + PIN form (pin-driver-login-form.tsx)
// in the meantime. Once the Google provider + redirect URLs are set up,
// swap this back in for driver_ifc and drop the temporary PIN path.

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
