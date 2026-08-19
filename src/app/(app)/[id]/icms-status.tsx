import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DIRECTION_LABELS, ROUTE_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { PartBC, PartD, Seal, Transaction } from "@/lib/database.types";
import { LiveRefresh } from "./live-refresh";
import { Row, Sig } from "./status-rows";

export async function IcmsStatus({ id }: { id: string }) {
  const supabase = await createClient();
  const { data: txRow } = await supabase.from("transactions").select("*").eq("id", id).single();
  if (!txRow) notFound();
  const transaction = txRow as Transaction;

  const [partBRes, partCRes, partDRes, sealsRes] = await Promise.all([
    supabase.from("part_b").select("*").eq("transaction_id", id).maybeSingle(),
    supabase.from("part_c").select("*").eq("transaction_id", id).maybeSingle(),
    supabase.from("part_d").select("*").eq("transaction_id", id).maybeSingle(),
    supabase.from("seals").select("*").eq("transaction_id", id).is("superseded_at", null),
  ]);
  const partB = partBRes.data as PartBC | null;
  const partC = partCRes.data as PartBC | null;
  const partD = partDRes.data as PartD | null;
  const seals = (sealsRes.data ?? []) as Seal[];

  const [sigB, sigC, sigD, completedFormUrl] = await Promise.all([
    signedUrl("signatures", partB?.signature_url ?? null),
    signedUrl("signatures", partC?.signature_url ?? null),
    signedUrl("signatures", partD?.signature_url ?? null),
    signedUrl("completed-forms", transaction.completed_form_url),
  ]);

  return (
    <div className="space-y-4">
      <LiveRefresh transactionId={transaction.id} tables={["transactions", "part_b", "part_c", "part_d"]} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{transaction.transaction_number}</h1>
          <div className="flex flex-wrap gap-1.5">
            <Badge className={STATUS_COLORS[transaction.status]}>{STATUS_LABELS[transaction.status]}</Badge>
            <Badge className="border border-border bg-transparent text-foreground">
              {DIRECTION_LABELS[transaction.direction]}
            </Badge>
            <Badge className="border border-border bg-transparent text-foreground">
              {ROUTE_LABELS[transaction.route]}
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
                Completed Form (PDF)
              </Button>
            </a>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-1 pt-6">
          <Row label="Vehicle" value={transaction.vehicle_number} />
          <Row label="Driver" value={`${transaction.driver_name} (${transaction.driver_id})`} />
          <Row label="Station" value={transaction.station ?? "—"} />
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

      {partB ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Part B</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="AVSEC" value={`${partB.avsec_name} (${partB.avsec_staff_id})`} />
            <Row label="Result" value={partB.result} />
            <Row label="Completed" value={formatDateTime(partB.completed_at)} />
            <Sig url={sigB} label="AVSEC signature" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Waiting for the next checkpoint to scan and verify.
          </CardContent>
        </Card>
      )}

      {partC ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Part C</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="AVSEC" value={`${partC.avsec_name} (${partC.avsec_staff_id})`} />
            <Row label="Result" value={partC.result} />
            <Row label="Completed" value={formatDateTime(partC.completed_at)} />
            <Sig url={sigC} label="AVSEC signature" />
          </CardContent>
        </Card>
      ) : null}

      {partD ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Part D — Delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Receiver" value={`${partD.receiver_name} (${partD.receiver_staff_id})`} />
            <Row label="Result" value={partD.result} />
            <Row label="Completed" value={formatDateTime(partD.completed_at)} />
            <Sig url={sigD} label="Receiver signature" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
