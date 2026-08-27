import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateClQrToken } from "@/lib/cl-qr-token";
import { QrDisplay } from "@/components/qr-display";
import { Button } from "@/components/ui/button";
import type { ClTransaction } from "@/lib/database.types";

export const metadata: Metadata = { title: "QR Pass — CaterLink" };
export const dynamic = "force-dynamic";

export default async function QrPassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();

  const supabase = await createClient();
  const { data } = await supabase
    .from("cl_transactions")
    .select("id, reference_number")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const transaction = data as Pick<ClTransaction, "id" | "reference_number">;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-8 text-center">
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-bold tracking-tight">Show this at every checkpoint</h1>
        <p className="text-sm text-muted-foreground">
          The QR pass expires 24 hours after it was generated.
        </p>
      </div>

      <QrDisplay
        token={generateClQrToken(transaction.id)}
        transactionNumber={transaction.reference_number}
        size={280}
      />

      <p className="text-xs text-muted-foreground">
        If the scanner fails, staff can enter the reference number above manually.
      </p>

      <Link href={`/${transaction.id}`} className="print:hidden">
        <Button variant="outline">View status</Button>
      </Link>
    </div>
  );
}
