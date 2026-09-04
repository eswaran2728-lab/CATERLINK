import { type NextRequest } from "next/server";
import { refreshMiddlewareSession } from "@/lib/auth/providers/supabase";

/** Refreshes the auth session on every request (standard @supabase/ssr pattern). */
export async function middleware(request: NextRequest) {
  return refreshMiddlewareSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
