import { NextResponse, type NextRequest } from "next/server";
import { refreshMiddlewareSession } from "@/lib/auth/providers/supabase";

/** Refreshes the auth session on every request (standard @supabase/ssr pattern).
 *  Firebase session cookies don't need this kind of per-request refresh
 *  the way Supabase JWTs do (see lib/auth/providers/firebase.ts's
 *  refresh()), and Firebase Admin SDK's verification isn't Edge-runtime
 *  compatible anyway — same limitation as VECTA's middleware, see its
 *  AUTH-CONTRACT.md for the full reasoning. Not a security regression:
 *  this middleware never did any gating beyond session refresh; all real
 *  enforcement is lib/auth.ts's requireProfile()/requireRole() and RLS. */
export async function middleware(request: NextRequest) {
  if (process.env.AUTH_PROVIDER === "firebase") {
    return NextResponse.next({ request });
  }
  return refreshMiddlewareSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
