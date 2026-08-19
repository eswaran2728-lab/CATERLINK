import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateQrToken } from "@/lib/qr-token";
import { QrDisplay } from "@/components/qr-display";
import { Button } from "@/components/ui/button";
import type { Transaction, VendorTransaction } from "@/lib/database.types";

export const metadata: Metadata = { title: "QR Pass — CaterLink" };
export const dynamic = "force-dynamic";

export default async function QrPassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const isIfc = profile.role === "driver_ifc";

  const supabase = await createClient();
  const { data } = await supabase
    .from(isIfc ? "transactions" : "vendor_transactions")
    .select("id, transaction_number")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const transaction = data as Pick<Transaction | VendorTransaction, "id" | "transaction_number">;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-8 text-center">
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-bold tracking-tight">Show this to AVSEC</h1>
        <p className="text-sm text-muted-foreground">
          The QR pass expires 24 hours after it was generated.
        </p>
      </div>

      <QrDisplay
        token={generateQrToken(transaction.id, isIfc ? "CATERING" : "VENDOR")}
        transactionNumber={transaction.transaction_number}
        size={280}
      />

      <p className="text-xs text-muted-foreground">
        If the scanner fails, AVSEC can enter the reference number above manually.
      </p>

      <Link href={`/${transaction.id}`} className="print:hidden">
        <Button variant="outline">View delivery status</Button>
      </Link>
    </div>
  );
}
