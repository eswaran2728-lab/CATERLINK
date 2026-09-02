import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DIRECTION_LABELS,
  HUB_DESTINATION_LABELS,
  ROUTE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  VENDOR_STATUS_COLORS,
  VENDOR_STATUS_LABELS,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { PartA, Seal, Transaction, VendorPartA, VendorTransaction } from "@/lib/database.types";
import { LiveRefresh } from "./live-refresh";
import { Row, Sig } from "./status-rows";

export const metadata: Metadata = { title: "Transaction status — CaterLink" };
export const dynamic = "force-dynamic";

export default async function TransactionStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();

  const supabase = await createClient();

  const { data: txRow } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();

  if (txRow) {
    const transaction = txRow as Transaction;
    const [partARes, sealsRes] = await Promise.all([
      supabase.from("part_a").select("*").eq("transaction_id", id).maybeSingle(),
      supabase.from("seals").select("*").eq("transaction_id", id),
    ]);
    const partA = partARes.data as PartA | null;
    const seals = (sealsRes.data ?? []) as Seal[];

    const [partASignatureUrl, completedFormUrl] = await Promise.all([
      signedUrl("signatures", partA?.signature_url ?? null),
      signedUrl("completed-forms", transaction.completed_form_url),
    ]);

    return (
      <div className="space-y-4">
        <LiveRefresh transactionId={transaction.id} tables={["transactions", "part_a", "seals"]} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight">{transaction.transaction_number}</h1>
            <div className="flex flex-wrap gap-1.5">
              <Badge className={STATUS_COLORS[transaction.status]}>{STATUS_LABELS[transaction.status]}</Badge>
              <Badge className="border border-border bg-transparent text-foreground">
                {DIRECTION_LABELS[transaction.direction]} · {ROUTE_LABELS[transaction.route]}
                {transaction.hub_destination ? ` (${HUB_DESTINATION_LABELS[transaction.hub_destination]})` : ""}
              </Badge>
            </div>
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
                  Completion PDF
                </Button>
              </a>
            ) : null}
          </div>
        </div>

        <Card>
          <CardContent className="space-y-1 pt-6">
            {transaction.station ? <Row label="Station" value={transaction.station} /> : null}
            <Row label="Vehicle" value={transaction.vehicle_number} />
            <Row label="Driver" value={`${transaction.driver_name} (${transaction.driver_id})`} />
            <Row label="Created" value={formatDateTime(transaction.created_at)} />
            <Row label="Completed" value={formatDateTime(transaction.completed_at)} />
          </CardContent>
        </Card>

        {seals.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {seals.map((s) => (
                <Row key={s.id} label={s.seal_type} value={`${s.seal_number} (${s.seal_color})`} />
              ))}
            </CardContent>
          </Card>
        ) : null}

        {partA ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Form A — completed by {partA.pic_name} at {formatDateTime(partA.completed_at)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                In-flight Catering Security Form (AA/SEC/F/010) — Part A only. Parts B, C and D are completed
                separately in VECTA.
              </p>
              <Row label="PIC" value={`${partA.pic_name} (${partA.pic_staff_id})`} />
              <Row label="Carts" value={transaction.supplies_carts} />
              <Row label="SMU" value={transaction.supplies_smu} />
              <Row label="Pallets" value={transaction.supplies_pallets} />
              <Row label="Boxes" value={transaction.supplies_boxes} />
              <Row label="Oven Rack" value={transaction.supplies_oven_racks} />
              <Sig url={partASignatureUrl} label="Signature" />
            </CardContent>
          </Card>
        ) : null}

        {transaction.status !== "COMPLETED" && transaction.status !== "ESCALATED" ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              In progress at checkpoints (VECTA). Current stage: Part {transaction.current_stage}.
            </CardContent>
          </Card>
        ) : null}

        {transaction.status === "ESCALATED" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-[#DC2626]">Escalated</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Row label="Reason" value={transaction.escalation_reason} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  const { data: vendorTxRow } = await supabase.from("vendor_transactions").select("*").eq("id", id).maybeSingle();
  if (!vendorTxRow) notFound();
  const transaction = vendorTxRow as VendorTransaction;

  const { data: vendorPartARow } = await supabase
    .from("vendor_part_a")
    .select("*")
    .eq("transaction_id", id)
    .maybeSingle();
  const partA = vendorPartARow as VendorPartA | null;

  const [partASignatureUrl, completedFormUrl] = await Promise.all([
    signedUrl("signatures", partA?.signature_url ?? null),
    signedUrl("completed-forms", transaction.completed_form_url),
  ]);

  return (
    <div className="space-y-4">
      <LiveRefresh transactionId={transaction.id} tables={["vendor_transactions", "vendor_part_a"]} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{transaction.transaction_number}</h1>
          <div className="flex flex-wrap gap-1.5">
            <Badge className={VENDOR_STATUS_COLORS[transaction.status]}>{VENDOR_STATUS_LABELS[transaction.status]}</Badge>
            <Badge className="border border-border bg-transparent text-foreground">Vendor Supply</Badge>
          </div>
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
                Completion PDF
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
            <CardTitle className="text-base">
              Form A — completed by {partA.driver_name} at {formatDateTime(partA.completed_at)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Vendor Supplies Security Form (AA/SEC/F/019) — Part A only. Parts B (AirAsia Security) and C
              (Warehouse) are completed separately in VECTA.
            </p>
            <Row label="Driver" value={partA.driver_name} />
            <Row label="NRIC Number" value={partA.nric_number} />
            <Row label="Seal Number" value={partA.seal_number} />
            <Sig url={partASignatureUrl} label="Signature" />
          </CardContent>
        </Card>
      ) : null}

      {transaction.status !== "COMPLETED" && transaction.status !== "ESCALATED" ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            In progress at checkpoints (VECTA).
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
