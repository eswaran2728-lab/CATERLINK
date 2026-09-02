import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTE_LABELS, STATUS_COLORS, STATUS_LABELS, VENDOR_STATUS_COLORS, VENDOR_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { Transaction, VendorTransaction } from "@/lib/database.types";

export const metadata: Metadata = { title: "History — CaterLink" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const profile = await requireProfile();
  const isWarehousePic = profile.role === "warehouse_pic";
  const isVendor = profile.role === "vendor";

  if (!isWarehousePic && !isVendor) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          This account isn&apos;t used to create CaterLink deliveries. Use VECTA for checkpoint duties.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();

  let transactions: Transaction[] = [];
  let vendorTransactions: VendorTransaction[] = [];

  if (isWarehousePic) {
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("created_by", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);
    transactions = (data ?? []) as Transaction[];
  } else {
    const { data } = await supabase
      .from("vendor_transactions")
      .select("*")
      .eq("created_by", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);
    vendorTransactions = (data ?? []) as VendorTransaction[];
  }

  const isEmpty = transactions.length === 0 && vendorTransactions.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">All your past movements.</p>
      </div>

      {isEmpty ? (
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
                    <p className="font-mono text-sm font-semibold">{t.transaction_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROUTE_LABELS[t.route]} · {formatDateTime(t.created_at)}
                    </p>
                  </div>
                  <Badge className={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
          {vendorTransactions.map((t) => (
            <Link key={t.id} href={`/${t.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-mono text-sm font-semibold">{t.transaction_number}</p>
                    <p className="text-xs text-muted-foreground">Vendor Supply · {formatDateTime(t.created_at)}</p>
                  </div>
                  <Badge className={VENDOR_STATUS_COLORS[t.status]}>{VENDOR_STATUS_LABELS[t.status]}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
