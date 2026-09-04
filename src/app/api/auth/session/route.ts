import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/auth/providers/firebase-admin";
import { SESSION_COOKIE, ID_TOKEN_COOKIE, SESSION_MAX_AGE_S, ID_TOKEN_MAX_AGE_S } from "@/lib/auth/providers/firebase-cookies";

export const dynamic = "force-dynamic";

/**
 * Establishes a server-readable session from a client-obtained Firebase ID
 * token, for this app's own origin — see components/auth/
 * GoogleSignInButton.tsx. Identical shape to VECTA's own
 * /api/auth/session; each app's cookies are scoped to its own domain, so
 * this can't be shared, only mirrored.
 *
 * Does NOT sync claims or check the workspace domain — that's VECTA's
 * /api/auth/sync-claims (called separately, cross-origin, by
 * GoogleSignInButton.tsx), since public.user_claims/setCustomUserClaims
 * should have exactly one caller across both apps.
 */
export async function POST(request: NextRequest) {
  let body: { idToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const idToken = body.idToken;
  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken." }, { status: 400 });
  }

  const auth = getFirebaseAdminAuth();
  try {
    await auth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_S * 1000,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  response.cookies.set(ID_TOKEN_COOKIE, idToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ID_TOKEN_MAX_AGE_S,
  });
  return response;
}
