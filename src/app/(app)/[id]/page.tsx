import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CL_STATUS_COLORS, CL_STATUS_LABELS, ROUTE_LABELS_CL, ROUTE_SIGNOFF_ROLE } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { ClSeal, ClSignoff, ClTransaction } from "@/lib/database.types";
import { LiveRefresh } from "./live-refresh";
import { Row, Sig } from "./status-rows";

export const metadata: Metadata = { title: "Transaction status — CaterLink" };
export const dynamic = "force-dynamic";

export default async function TransactionStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();

  const supabase = await createClient();
  const { data: txRow } = await supabase.from("cl_transactions").select("*").eq("id", id).single();
  if (!txRow) notFound();
  const transaction = txRow as ClTransaction;

  const [sealsRes, signoffRes] = await Promise.all([
    supabase.from("cl_seals").select("*").eq("transaction_id", id),
    supabase.from("cl_signoffs").select("*").eq("transaction_id", id).maybeSingle(),
  ]);
  const seals = (sealsRes.data ?? []) as ClSeal[];
  const signoff = signoffRes.data as ClSignoff | null;

  const [signatureUrl, completedFormUrl] = await Promise.all([
    signedUrl("signatures", signoff?.signature_url ?? null),
    signedUrl("completed-forms", transaction.completed_form_url),
  ]);

  const requiredSignoffRole = ROUTE_SIGNOFF_ROLE[transaction.route];
  const canSignOff = transaction.status === "CREATED" && profile.role === requiredSignoffRole;

  return (
    <div className="space-y-4">
      <LiveRefresh transactionId={transaction.id} tables={["cl_transactions", "cl_signoffs"]} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{transaction.reference_number}</h1>
          <div className="flex flex-wrap gap-1.5">
            <Badge className={CL_STATUS_COLORS[transaction.status]}>{CL_STATUS_LABELS[transaction.status]}</Badge>
            <Badge className="border border-border bg-transparent text-foreground">
              {ROUTE_LABELS_CL[transaction.route]}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/${transaction.id}/qr`}>
            <Button variant="outline" size="sm">
              QR Pass
            </Button>
          </Link>
          {canSignOff ? (
            <Link href={`/${transaction.id}/signoff`}>
              <Button size="sm">Sign Off</Button>
            </Link>
          ) : null}
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
          <Row label="Vehicle" value={transaction.vehicle_number} />
          <Row label="Driver" value={`${transaction.driver_name}${transaction.driver_id ? ` (${transaction.driver_id})` : ""}`} />
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

      {transaction.status === "CREATED" ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            In progress at checkpoints (VECTA). Awaiting sign-off by <strong>{requiredSignoffRole}</strong> at the
            final checkpoint.
          </CardContent>
        </Card>
      ) : null}

      {signoff ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signed Off</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Role" value={signoff.signer_role} />
            <Row label="Signed At" value={formatDateTime(signoff.signed_at)} />
            <Sig url={signatureUrl} label="Signature" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
