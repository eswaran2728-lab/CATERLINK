import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { AuthProvider, AuthSession, AuthUser, SignInResult } from "../types";

function toAuthUser(user: { id: string; email?: string | null } | null): AuthUser | null {
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

export const supabaseAuthProvider: AuthProvider = {
  async signIn(email, password): Promise<SignInResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { user: null, error: error?.message ?? "Invalid email or password." };
    }
    return { user: toAuthUser(data.user), error: null };
  },

  async signOut(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
  },

  async getSession(): Promise<AuthSession | null> {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;
    return { user: toAuthUser(session.user)!, accessToken: session.access_token };
  },

  async getUser(): Promise<AuthUser | null> {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return toAuthUser(user);
  },

  async getAccessToken(): Promise<string | null> {
    const session = await this.getSession();
    return session?.accessToken ?? null;
  },

  onAuthStateChange(): () => void {
    // Server-side only adapter — no live subscription here. The one
    // client-side call site (sign-out-button.tsx) uses
    // lib/supabase/client.ts's browser client directly.
    return () => {};
  },

  async refresh(): Promise<AuthSession | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session?.user) return null;
    return { user: toAuthUser(data.session.user)!, accessToken: data.session.access_token };
  },
};

/**
 * Edge-middleware session refresh. Kept here (not in middleware.ts) so the
 * Supabase SDK's auth surface is imported only from this adapter folder —
 * the CI boundary check (scripts/check-auth-boundary.sh) enforces that.
 * Identical to the previous inline implementation in src/middleware.ts.
 */
export async function refreshMiddlewareSession(
  request: NextRequest
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}
