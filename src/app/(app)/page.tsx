import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VENDOR_STATUS_COLORS, VENDOR_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { VendorTransaction } from "@/lib/database.types";

export const metadata: Metadata = { title: "CaterLink" };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await requireProfile();
  if (profile.role === "vendor") redirect("/admin/drivers");
  if (profile.role !== "driver_ifc" && profile.role !== "driver_vendor") {
    redirect("/login?error=no-profile");
  }

  const supabase = await createClient();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("vendor_transactions")
    .select("*")
    .gte("created_at", startOfToday.toISOString())
    .order("created_at", { ascending: false });

  const transactions = (data ?? []) as VendorTransaction[];

  return (
    <div className="space-y-6">
      <Link href="/new">
        <Button size="xl" className="w-full">
          + New Delivery
        </Button>
      </Link>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Today&apos;s deliveries</h2>
        {transactions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No deliveries yet today.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => (
              <Link key={t.id} href={`/${t.id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-mono text-sm font-semibold">{t.transaction_number}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</p>
                    </div>
                    <Badge className={VENDOR_STATUS_COLORS[t.status]}>
                      {VENDOR_STATUS_LABELS[t.status]}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
