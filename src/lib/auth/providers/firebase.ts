import "server-only";

import { cookies } from "next/headers";
import { getFirebaseAdminAuth } from "./firebase-admin";
import { SESSION_COOKIE, ID_TOKEN_COOKIE } from "./firebase-cookies";
import type { AuthProvider, AuthSession, AuthUser, SignInResult } from "../types";

function toAuthUser(decoded: { uid: string; email?: string }): AuthUser {
  return { id: decoded.uid, email: decoded.email ?? null };
}

export const firebaseAuthProvider: AuthProvider = {
  async signIn(): Promise<SignInResult> {
    // Google sign-in is inherently a browser operation (signInWithPopup),
    // not something a server-side password call can do. The real flow:
    // components/auth/GoogleSignInButton.tsx runs signInWithPopup
    // client-side, then POSTs the resulting ID token to this app's own
    // /api/auth/session (which this adapter's getUser()/getSession()
    // then read back via the fb-session cookie it sets) and to VECTA's
    // /api/auth/sync-claims (cross-origin — CaterLink has no
    // public.profiles/users write access of its own to sync from).
    return {
      user: null,
      error:
        "Firebase auth uses Google sign-in (see GoogleSignInButton), not email/password.",
    };
  },

  async signOut(): Promise<void> {
    const store = await cookies();
    const sessionCookie = store.get(SESSION_COOKIE)?.value;
    if (sessionCookie) {
      try {
        const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie);
        await getFirebaseAdminAuth().revokeRefreshTokens(decoded.uid);
      } catch {
        // Already invalid/expired — nothing to revoke.
      }
    }
    store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    store.set(ID_TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  },

  async getSession(): Promise<AuthSession | null> {
    const store = await cookies();
    const sessionCookie = store.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) return null;
    try {
      const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
      const accessToken = store.get(ID_TOKEN_COOKIE)?.value ?? "";
      return { user: toAuthUser(decoded), accessToken };
    } catch {
      return null;
    }
  },

  async getUser(): Promise<AuthUser | null> {
    const store = await cookies();
    const sessionCookie = store.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) return null;
    try {
      const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
      return toAuthUser(decoded);
    } catch {
      return null;
    }
  },

  async getAccessToken(): Promise<string | null> {
    // Returns the raw ID token cookie set at session-establishment time —
    // NOT re-minted here. Same known limitation as VECTA's adapter: this
    // token is only valid for ~1 hour with no server-side refresh path.
    // Directly affects this app specifically, since it's the caller in
    // the QR-mint bearer-token flow to VECTA's /api/icms/qr/mint — see
    // AUTH-CONTRACT.md's Phase 3 status section.
    const store = await cookies();
    return store.get(ID_TOKEN_COOKIE)?.value ?? null;
  },

  onAuthStateChange(): () => void {
    return () => {};
  },

  async refresh(): Promise<AuthSession | null> {
    return this.getSession();
  },
};
