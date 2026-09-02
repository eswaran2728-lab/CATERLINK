"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { uploadDataUrl } from "@/lib/storage";
import { mintQrToken } from "@/lib/vecta-api";

export interface ActionState {
  error: string | null;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * vendor (VECTA's real role — see the CaterLink<->VECTA Forms
 * Integration Contract) creates a Vendor Supply movement (AA/SEC/F/019),
 * writing directly into VECTA's vendor_transactions/vendor_part_a
 * tables. VECTA owns Parts B/C entirely from here.
 */
export async function createVendorTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole(["vendor"]);

  const driverName = str(formData, "driver_name");
  const nricNumber = str(formData, "nric_number");
  const sealNumber = str(formData, "seal_number").toUpperCase();
  const signature = str(formData, "signature");

  if (!driverName || !nricNumber || !sealNumber) {
    return { error: "Driver name, NRIC number and seal number are all required." };
  }
  if (!signature) {
    return { error: "Signature is required." };
  }

  const supabase = await createClient();
  const { data: tx, error: txError } = await supabase
    .from("vendor_transactions")
    .insert({ created_by: profile.id })
    .select()
    .single();

  if (txError || !tx) {
    return { error: `Could not create delivery: ${txError?.message ?? "unknown error"}` };
  }

  let signaturePath: string;
  try {
    signaturePath = (await uploadDataUrl("signatures", signature, "vendor-part-a")).path;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Signature upload failed." };
  }

  const { error: partAError } = await supabase.from("vendor_part_a").insert({
    transaction_id: tx.id,
    driver_name: driverName,
    nric_number: nricNumber,
    seal_number: sealNumber,
    signature_url: signaturePath,
    completed_by: profile.id,
  });
  if (partAError) {
    return { error: `Part A could not be saved: ${partAError.message}` };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { error: "Session expired — please sign in again before creating a delivery." };
  }

  try {
    const qrToken = await mintQrToken({ transactionId: tx.id, type: "VENDOR", accessToken: session.access_token });
    const { error: qrError } = await supabase.rpc("set_vendor_transaction_qr_token", {
      p_transaction_id: tx.id,
      p_qr_token: qrToken,
    });
    if (qrError) throw new Error(`QR minted but could not be saved: ${qrError.message}`);
  } catch (e) {
    return {
      error:
        (e instanceof Error ? e.message : "Could not mint the QR pass.") +
        ` The delivery was created (${tx.transaction_number}) — open it from Home to retry the QR pass.`,
    };
  }

  revalidatePath("/");
  redirect(`/${tx.id}/qr?created=1&vendor=1`);
}
