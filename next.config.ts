import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin's dependency chain (jwks-rsa -> jose) mixes ESM-only
  // and CJS builds in a way Next's bundler resolves incorrectly for
  // serverless functions (ERR_REQUIRE_ESM at runtime). Excluding it from
  // bundling lets Node's own require()/import resolution handle it
  // correctly instead — the standard fix for firebase-admin + Next.js.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
