import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mintQrToken } from "@/lib/vecta-api";
import { QrDisplay } from "@/components/qr-display";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "QR Pass — CaterLink" };
export const dynamic = "force-dynamic";

export default async function QrPassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();

  const supabase = await createClient();

  const [txRes, vendorTxRes] = await Promise.all([
    supabase.from("transactions").select("id, transaction_number, qr_token").eq("id", id).maybeSingle(),
    supabase.from("vendor_transactions").select("id, transaction_number, qr_token").eq("id", id).maybeSingle(),
  ]);

  const record = txRes.data ?? vendorTxRes.data;
  if (!record) notFound();
  const isVendor = !txRes.data;

  let qrToken = record.qr_token;
  if (!qrToken) {
    // Creation-time mint can fail transiently (VECTA unreachable) — retry
    // on view instead of leaving the driver stuck with no QR pass at all.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      try {
        qrToken = await mintQrToken({
          transactionId: record.id,
          type: isVendor ? "VENDOR" : "CATERING",
          accessToken: session.access_token,
        });
        await supabase
          .from(isVendor ? "vendor_transactions" : "transactions")
          .update({ qr_token: qrToken })
          .eq("id", record.id);
      } catch {
        qrToken = null;
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-8 text-center">
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-bold tracking-tight">Show this at every checkpoint</h1>
        <p className="text-sm text-muted-foreground">
          The QR pass expires 24 hours after it was generated.
        </p>
      </div>

      {qrToken ? (
        <QrDisplay token={qrToken} transactionNumber={record.transaction_number} size={280} />
      ) : (
        <p role="alert" className="text-sm font-medium text-[#FB7185]">
          Could not generate the QR pass — VECTA may be unreachable. Reload this page to retry.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        If the scanner fails, staff can enter the reference number above manually.
      </p>

      <Link href={`/${record.id}`} className="print:hidden">
        <Button variant="outline">View status</Button>
      </Link>
    </div>
  );
}
