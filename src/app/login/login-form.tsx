"use client";

import { useState } from "react";
import { useActionState } from "react";
import { signIn, type AuthState } from "@/lib/actions/auth-session";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setGoogleError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) {
        setGoogleError(error.message);
        setIsGoogleLoading(false);
      }
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : "Failed to connect to Google");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        size="xl"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || pending}
        className="w-full flex items-center justify-center gap-3 font-semibold shadow-sm border-border hover:bg-accent"
      >
        {isGoogleLoading ? (
          <span className="text-xs text-muted-foreground animate-pulse">Connecting to Google SSO...</span>
        ) : (
          <>
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27a7.22 7.22 0 0 1 0-4.54V6.58H1.26a11.97 11.97 0 0 0 0 10.84l4.02-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Sign in with Google / SSO</span>
          </>
        )}
      </Button>

      {googleError ? (
        <p role="alert" className="text-sm font-medium text-[#DC2626]">
          {googleError}
        </p>
      ) : null}

      <div className="my-1 flex items-center gap-3">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          or password sign-in
        </span>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      <form action={formAction} className="flex flex-col gap-3.5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@vendor.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="•••••••••"
            required
          />
        </div>

        {state.error ? (
          <p role="alert" className="text-sm font-medium text-[#DC2626]">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="xl" className="mt-1.5 w-full" disabled={pending || isGoogleLoading}>
          {pending ? "Signing in…" : "Sign In"}
        </Button>
      </form>
    </div>
  );
}
