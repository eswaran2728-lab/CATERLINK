import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CL_STATUS_COLORS, CL_STATUS_LABELS, ROUTE_LABELS_CL, ROUTE_SIGNOFF_ROLE } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { ClTransaction } from "@/lib/database.types";

export const metadata: Metadata = { title: "CaterLink" };
export const dynamic = "force-dynamic";

const CREATOR_ROLES = ["warehouse_pic", "driver_vendor"];
const SIGNER_ROLES = ["post2_avsec", "post6_avsec", "hub_avsec", "receiver"];

export default async function HomePage() {
  const profile = await requireProfile();
  const isCreator = CREATOR_ROLES.includes(profile.role);
  const isSigner = SIGNER_ROLES.includes(profile.role);

  const supabase = await createClient();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("cl_transactions")
    .select("*")
    .gte("created_at", startOfToday.toISOString())
    .order("created_at", { ascending: false });

  const transactions = (data ?? []) as ClTransaction[];

  return (
    <div className="space-y-6">
      {isCreator ? (
        <Link href="/new">
          <Button size="xl" className="w-full animate-pulse-glow">
            + New Delivery
          </Button>
        </Link>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Today&apos;s transactions</h2>
        {transactions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet today.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => {
              const needsMySignoff =
                isSigner && t.status === "CREATED" && ROUTE_SIGNOFF_ROLE[t.route] === profile.role;
              return (
                <Link key={t.id} href={`/${t.id}`}>
                  <Card
                    className={
                      needsMySignoff
                        ? "bg-primary/5 ring-1 ring-inset ring-primary/20 transition-colors hover:bg-primary/10"
                        : "transition-colors hover:bg-accent"
                    }
                  >
                    <CardContent className="flex items-center justify-between gap-3 py-4">
                      <div>
                        <p className="font-mono text-sm font-semibold">
                          {t.reference_number}
                          {needsMySignoff ? (
                            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                              Needs your sign-off
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ROUTE_LABELS_CL[t.route]} · {formatDateTime(t.created_at)}
                        </p>
                      </div>
                      <Badge className={CL_STATUS_COLORS[t.status]}>{CL_STATUS_LABELS[t.status]}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
