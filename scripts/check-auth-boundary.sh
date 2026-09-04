#!/usr/bin/env bash
# Fails the build if a Supabase (or Firebase, once Phase 3 lands) auth SDK
# session/identity call is made from outside src/lib/auth/providers/. Those
# calls should go through src/lib/auth/provider.ts's getAuthProvider() (or
# src/lib/auth/guards.ts's getAuthUser()/requireAuth()) instead — see
# MIGRATION-AUDIT.md and the master migration plan's Phase 1.
#
# Deliberately out of scope: auth.admin.createUser/deleteUser (account
# provisioning isn't part of the AuthProvider interface in
# src/lib/auth/types.ts — Firebase Admin SDK's shape differs enough that
# this gets its own adapter in Phase 3) and plain .from(...)/.storage.*
# Supabase calls, which have nothing to do with authentication.
set -euo pipefail

cd "$(dirname "$0")/.."

METHODS='\.auth\.(getUser|getSession|signInWithPassword|signOut|onAuthStateChange|refreshSession|exchangeCodeForSession)\('

# Files allowed to call these directly because they ARE the adapter, or
# because there's no client-side AuthProvider surface yet (this is the
# app's only client-component auth call — see inline comment at the site).
ALLOWLIST=(
  "./src/lib/auth/providers/supabase.ts"
  "./src/lib/auth/providers/firebase.ts"
  "./src/app/(app)/sign-out-button.tsx"
)

is_allowed() {
  local f="$1"
  for allowed in "${ALLOWLIST[@]}"; do
    [ "$f" = "$allowed" ] && return 0
  done
  return 1
}

violations=()
while IFS= read -r -d '' file; do
  is_allowed "$file" && continue
  if grep -qE "$METHODS" "$file"; then
    violations+=("$file")
  fi
done < <(find . -type f \( -name '*.ts' -o -name '*.tsx' \) \
  -not -path './node_modules/*' -not -path './.next/*' -print0)

if [ "${#violations[@]}" -gt 0 ]; then
  echo "auth boundary violation: supabase.auth session/identity calls found outside src/lib/auth/providers/:" >&2
  printf '  %s\n' "${violations[@]}" >&2
  echo "Route these through src/lib/auth/provider.ts's getAuthProvider() or src/lib/auth/guards.ts instead." >&2
  exit 1
fi

echo "auth boundary check passed."
