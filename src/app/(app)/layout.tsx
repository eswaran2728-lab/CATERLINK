import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { ROLE_COLORS, ROLE_LABELS } from "@/lib/constants";
import { SignOutButton } from "./sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-heading text-lg font-bold tracking-tight">
            CaterLink
          </Link>
          <div className="flex items-center gap-2">
            {profile.role === "vendor" ? (
              <Link href="/admin/drivers" className="text-sm text-muted-foreground hover:text-foreground">
                Drivers
              </Link>
            ) : null}
            <Badge className={ROLE_COLORS[profile.role]}>{ROLE_LABELS[profile.role]}</Badge>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
