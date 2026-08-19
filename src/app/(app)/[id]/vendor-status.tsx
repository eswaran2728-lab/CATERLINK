import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VENDOR_STATUS_COLORS, VENDOR_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { VendorPartA, VendorPartB, VendorPartC, VendorTransaction } from "@/lib/database.types";
import { LiveRefresh } from "./live-refresh";
import { Row, Sig } from "./status-rows";

export async function VendorStatus({ id }: { id: string }) {
  const supabase = await createClient();
  const { data: txRow } = await supabase.from("vendor_transactions").select("*").eq("id", id).single();
  if (!txRow) notFound();
  const transaction = txRow as VendorTransaction;

  const [partARes, partBRes, partCRes] = await Promise.all([
    supabase.from("vendor_part_a").select("*").eq("transaction_id", id).maybeSingle(),
    supabase.from("vendor_part_b").select("*").eq("transaction_id", id).maybeSingle(),
    supabase.from("vendor_part_c").select("*").eq("transaction_id", id).maybeSingle(),
  ]);
  const partA = partARes.data as VendorPartA | null;
  const partB = partBRes.data as VendorPartB | null;
  const partC = partCRes.data as VendorPartC | null;

  const [sigA, sigB, sigWarehouse, sigVendor, completedFormUrl] = await Promise.all([
    signedUrl("signatures", partA?.signature_url ?? null),
    signedUrl("signatures", partB?.signature_url ?? null),
    signedUrl("signatures", partC?.warehouse_signature_url ?? null),
    signedUrl("signatures", partC?.vendor_signature_url ?? null),
    signedUrl("completed-forms", transaction.completed_form_url),
  ]);

  return (
    <div className="space-y-4">
      <LiveRefresh transactionId={transaction.id} tables={["vendor_transactions", "vendor_part_b", "vendor_part_c"]} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{transaction.transaction_number}</h1>
          <Badge className={VENDOR_STATUS_COLORS[transaction.status]}>{VENDOR_STATUS_LABELS[transaction.status]}</Badge>
        </div>
        <div className="flex gap-2">
          <Link href={`/${transaction.id}/qr`}>
            <Button variant="outline" size="sm">
              QR Pass
            </Button>
          </Link>
          {completedFormUrl ? (
            <a href={completedFormUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                Completed Form (PDF)
              </Button>
            </a>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-1 pt-6">
          <Row label="Created" value={formatDateTime(transaction.created_at)} />
          <Row label="Completed" value={formatDateTime(transaction.completed_at)} />
        </CardContent>
      </Card>

      {partA ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Part A — Driver</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Driver" value={partA.driver_name} />
            <Row label="NRIC" value={partA.nric_number} />
            <Row label="Seal Number" value={partA.seal_number} />
            <Row label="Completed" value={formatDateTime(partA.completed_at)} />
            <Sig url={sigA} label="Driver signature" />
          </CardContent>
        </Card>
      ) : null}

      {partB ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Part B — AirAsia Security (Post 2)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Vehicle Reg. No" value={partB.vehicle_registration_no} />
            <Row label="Driver" value={`${partB.driver_name} (${partB.driver_nric})`} />
            <Row label="Seal Number" value={partB.seal_number} />
            <Row label="Completed" value={formatDateTime(partB.completed_at)} />
            {partB.remarks ? <p className="text-sm text-muted-foreground">&ldquo;{partB.remarks}&rdquo;</p> : null}
            <Sig url={sigB} label="AVSEC signature" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Waiting for AVSEC to scan and complete Part B.
          </CardContent>
        </Card>
      )}

      {partC ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Part C — Warehouse (In-Flight)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Row label="Warehouse PIC" value={partC.warehouse_pic_name ?? "—"} />
              <Row label="Signed At" value={formatDateTime(partC.warehouse_signed_at)} />
              <Sig url={sigWarehouse} label="Warehouse PIC signature" />
            </div>
            <div className="space-y-3">
              <Row label="Driver" value={partC.vendor_driver_name ?? "—"} />
              <Row label="Signed At" value={formatDateTime(partC.vendor_signed_at)} />
              <Sig url={sigVendor} label="Driver signature" />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
