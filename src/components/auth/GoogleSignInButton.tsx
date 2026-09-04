"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { signInWithGoogle } from "@/lib/auth/providers/firebase-client";
import { Button } from "@/components/ui/button";

/**
 * Same flow as VECTA's GoogleSignInButton, with one difference: claims
 * sync is a cross-origin call to VECTA's /api/auth/sync-claims
 * (NEXT_PUBLIC_VECTA_API_BASE_URL) rather than a local route — CaterLink has
 * no public.profiles/users write access of its own to sync claims from,
 * and that endpoint is meant to have exactly one implementation across
 * both apps. See VECTA's app/api/auth/sync-claims/route.ts for the CORS
 * configuration that allows this specific cross-origin call.
 */
export function GoogleSignInButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const vectaAppUrl = process.env.NEXT_PUBLIC_VECTA_API_BASE_URL;
      if (!vectaAppUrl) {
        throw new Error("NEXT_PUBLIC_VECTA_API_BASE_URL is not configured.");
      }

      const user = await signInWithGoogle();
      const idToken = await user.getIdToken();

      const sessionRes = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!sessionRes.ok) {
        const body = await sessionRes.json().catch(() => ({}) as { error?: string });
        throw new Error(body.error ?? "Could not establish session.");
      }

      const syncRes = await fetch(`${vectaAppUrl}/api/auth/sync-claims`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!syncRes.ok) {
        const body = await syncRes.json().catch(() => ({}) as { error?: string });
        throw new Error(body.error ?? "Could not sync your account.");
      }

      await user.getIdToken(true);

      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" onClick={handleClick} disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in with Google Workspace"}
      </Button>
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-[#DC2626]">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
