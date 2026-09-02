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
import type { ClFormA, ClSeal, ClSignoff, ClTransaction } from "@/lib/database.types";
import { LiveRefresh } from "./live-refresh";
import { Row, Sig } from "./status-rows";
import { CancelForm } from "./cancel-form";

export const metadata: Metadata = { title: "Transaction status — CaterLink" };
export const dynamic = "force-dynamic";

export default async function TransactionStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();

  const supabase = await createClient();
  const { data: txRow } = await supabase.from("cl_transactions").select("*").eq("id", id).single();
  if (!txRow) notFound();
  const transaction = txRow as ClTransaction;

  const [sealsRes, signoffRes, formARes] = await Promise.all([
    supabase.from("cl_seals").select("*").eq("transaction_id", id),
    supabase.from("cl_signoffs").select("*").eq("transaction_id", id).maybeSingle(),
    supabase.from("cl_form_a").select("*").eq("transaction_id", id).maybeSingle(),
  ]);
  const seals = (sealsRes.data ?? []) as ClSeal[];
  const signoff = signoffRes.data as ClSignoff | null;
  const formA = formARes.data as ClFormA | null;

  const [signatureUrl, completedFormUrl, formASignatureUrl] = await Promise.all([
    signedUrl("signatures", signoff?.signature_url ?? null),
    signedUrl("completed-forms", transaction.completed_form_url),
    signedUrl("signatures", formA?.signature_url ?? null),
  ]);

  const requiredSignoffRole = ROUTE_SIGNOFF_ROLE[transaction.route];
  const canSignOff = transaction.status === "CREATED" && profile.role === requiredSignoffRole;
  const canCancel =
    transaction.status === "CREATED" &&
    (transaction.created_by === profile.id || profile.role === "supervisor");

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
          {transaction.station ? <Row label="Station" value={transaction.station} /> : null}
          <Row label="Vehicle" value={transaction.vehicle_number} />
          <Row label="Driver" value={`${transaction.driver_name}${transaction.driver_id ? ` (${transaction.driver_id})` : ""}`} />
          <Row label="Created" value={formatDateTime(transaction.created_at)} />
          <Row label="Completed" value={formatDateTime(transaction.completed_at)} />
        </CardContent>
      </Card>

      {formA ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Form A — completed by {transaction.route === "VENDOR_SUPPLY" ? transaction.driver_name : formA.certifying_name} at{" "}
              {formatDateTime(formA.certified_at)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {transaction.route === "VENDOR_SUPPLY"
                ? "Vendor Supplies Security Form (AA/SEC/F/019) — Part A only. Parts B (AirAsia Security) and C (Warehouse) are completed separately in VECTA."
                : "In-flight Catering Security Form (AA/SEC/F/010) — Part A only. Parts B, C and D are completed separately in VECTA."}
            </p>
            {transaction.route === "VENDOR_SUPPLY" ? (
              <>
                <Row label="Driver" value={transaction.driver_name} />
                <Row label="NRIC Number" value={transaction.driver_id} />
                <Row label="In-flight Supplies" value={formA.supplies_description} />
              </>
            ) : (
              <>
                <Row label="Certifying Staff" value={`${formA.certifying_name} (${formA.certifying_id})`} />
                <Row label="Carts" value={formA.carts} />
                <Row label="SMU" value={formA.smu} />
                <Row label="Pallets" value={formA.pallets} />
                <Row label="Boxes" value={formA.boxes} />
                <Row label="Oven Rack" value={formA.oven_rack} />
              </>
            )}
            <Sig url={formASignatureUrl} label="Signature" />
          </CardContent>
        </Card>
      ) : null}

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
          <CardContent className="space-y-4 py-6 text-center text-sm text-muted-foreground">
            <p>
              In progress at checkpoints (VECTA). Awaiting sign-off by <strong>{requiredSignoffRole}</strong> at the
              final checkpoint.
            </p>
            {canCancel ? (
              <div className="flex justify-center">
                <CancelForm transactionId={transaction.id} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {transaction.status === "CANCELLED" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#FB7185]">Cancelled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Row label="Reason" value={transaction.cancelled_reason} />
            <Row label="Cancelled At" value={formatDateTime(transaction.cancelled_at)} />
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
