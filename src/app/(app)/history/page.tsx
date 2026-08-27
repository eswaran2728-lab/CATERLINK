import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CL_STATUS_COLORS, CL_STATUS_LABELS, ROUTE_LABELS_CL } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { ClTransaction } from "@/lib/database.types";

export const metadata: Metadata = { title: "History — CaterLink" };
export const dynamic = "force-dynamic";

const CREATOR_ROLES = ["warehouse_pic", "driver_vendor"];
const SIGNER_ROLES = ["post2_avsec", "post6_avsec", "hub_avsec", "receiver"];

export default async function HistoryPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  let transactions: ClTransaction[] = [];

  if (CREATOR_ROLES.includes(profile.role)) {
    const { data } = await supabase
      .from("cl_transactions")
      .select("*")
      .eq("created_by", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);
    transactions = (data ?? []) as ClTransaction[];
  } else if (SIGNER_ROLES.includes(profile.role)) {
    const { data } = await supabase
      .from("cl_signoffs")
      .select("cl_transactions(*)")
      .eq("signer_id", profile.id)
      .order("signed_at", { ascending: false })
      .limit(100);
    transactions = ((data ?? []) as unknown as { cl_transactions: ClTransaction }[])
      .map((row) => row.cl_transactions)
      .filter(Boolean);
  } else {
    const { data } = await supabase
      .from("cl_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    transactions = (data ?? []) as ClTransaction[];
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">
          {CREATOR_ROLES.includes(profile.role) ? "All your past movements." : "Transactions you've signed off."}
        </p>
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Nothing here yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <Link key={t.id} href={`/${t.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-mono text-sm font-semibold">{t.reference_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROUTE_LABELS_CL[t.route]} · {formatDateTime(t.created_at)}
                    </p>
                  </div>
                  <Badge className={CL_STATUS_COLORS[t.status]}>{CL_STATUS_LABELS[t.status]}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
