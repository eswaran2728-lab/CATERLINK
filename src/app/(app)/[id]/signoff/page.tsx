import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROUTE_LABELS_CL, ROUTE_SIGNOFF_ROLE } from "@/lib/constants";
import type { ClTransaction } from "@/lib/database.types";
import { SignoffForm } from "./signoff-form";

export const metadata: Metadata = { title: "Sign Off — CaterLink" };
export const dynamic = "force-dynamic";

export default async function SignoffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();

  const supabase = await createClient();
  const { data } = await supabase.from("cl_transactions").select("*").eq("id", id).single();
  if (!data) notFound();
  const transaction = data as ClTransaction;

  const requiredRole = ROUTE_SIGNOFF_ROLE[transaction.route];
  if (transaction.status !== "CREATED" || profile.role !== requiredRole) {
    redirect(`/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Sign Off</h1>
        <p className="text-sm text-muted-foreground">
          {transaction.reference_number} — {ROUTE_LABELS_CL[transaction.route]}. This is the final checkpoint;
          signing completes the transaction and generates the completion PDF for both parties.
        </p>
      </div>
      <SignoffForm transactionId={transaction.id} />
    </div>
  );
}
