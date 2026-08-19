"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { uploadDataUrl } from "@/lib/storage";
import { generateQrToken } from "@/lib/qr-token";

export interface ActionState {
  error: string | null;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Vendor Movement Module Part A: a driver (IFC staff or vendor driver)
 * creates their own delivery record and gets a signed QR pass. Ported
 * from icms-airasia's createVendorTransaction — same shape, same RLS
 * contract, only the allowed caller roles differ (driver_ifc/driver_vendor
 * here instead of icms-airasia's single 'vendor' role).
 */
export async function createVendorTransaction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireRole(["driver_ifc", "driver_vendor"]);

  const driverName = str(formData, "driver_name");
  const nricNumber = str(formData, "nric_number");
  const sealNumber = str(formData, "seal_number");
  const signature = str(formData, "signature");

  if (!driverName || !nricNumber || !sealNumber) {
    return { error: "Driver name, NRIC number and seal number are all required." };
  }
  if (!signature) {
    return { error: "Signature is required." };
  }

  let sig: { path: string; sha256: string };
  try {
    sig = await uploadDataUrl("signatures", signature, "vendor-signatures");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Signature upload failed." };
  }

  const supabase = await createClient();
  const txId = crypto.randomUUID();
  const { data: tx, error: txError } = await supabase
    .from("vendor_transactions")
    .insert({ id: txId, created_by: profile.id, qr_token: generateQrToken(txId, "VENDOR") })
    .select()
    .single();

  if (txError || !tx) {
    return { error: `Could not create vendor transaction: ${txError?.message ?? "unknown error"}` };
  }

  const { error: partError } = await supabase.from("vendor_part_a").insert({
    transaction_id: tx.id,
    driver_name: driverName,
    nric_number: nricNumber,
    seal_number: sealNumber,
    signature_url: sig.path,
    completed_by: profile.id,
  });

  if (partError) {
    return { error: `Part A could not be saved: ${partError.message}` };
  }

  revalidatePath("/");
  redirect(`/${tx.id}/qr?created=1`);
}
