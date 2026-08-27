import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_COLORS, ROLE_LABELS } from "@/lib/constants";
import { SignOutButton } from "../sign-out-button";

export const metadata: Metadata = { title: "Profile — CaterLink" };
export const dynamic = "force-dynamic";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export default async function ProfilePage() {
  const profile = await requireProfile();

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl font-bold tracking-tight">Profile</h1>

      <div className="flex flex-col items-center gap-3">
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[1.5px] border-[rgba(245,166,35,0.35)] bg-card font-heading text-2xl font-bold text-primary">
          {initials(profile.name)}
        </div>
        <div className="text-center">
          <p className="font-heading text-lg font-bold">{profile.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{profile.email}</p>
        </div>
        <Badge className={ROLE_COLORS[profile.role]}>{ROLE_LABELS[profile.role]}</Badge>
      </div>

      <Card>
        <CardContent className="divide-y divide-border p-0">
          <div className="flex justify-between px-4 py-3.5">
            <span className="text-sm text-muted-foreground">Driver / Staff ID</span>
            <span className="font-mono text-sm">{profile.staff_id}</span>
          </div>
          <div className="flex justify-between px-4 py-3.5">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className="text-sm font-semibold capitalize">{profile.status}</span>
          </div>
        </CardContent>
      </Card>

      <SignOutButton />
    </div>
  );
}
