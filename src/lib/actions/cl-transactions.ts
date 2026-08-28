"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole } from "@/lib/auth";
import { uploadDataUrl, uploadPdfBuffer } from "@/lib/storage";
import { generateClQrToken } from "@/lib/cl-qr-token";
import { generateClCompletionPdf } from "@/lib/cl-pdf";
import { ROUTE_SIGNOFF_ROLE } from "@/lib/constants";
import { parseSealDrafts, namesMatch, buildWhitelistViolationMessage } from "@/lib/seal-parsing";
import type { CargoType, ClRoute } from "@/lib/database.types";
import type { ClSeal } from "@/lib/database.types";

export interface ActionState {
  error: string | null;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

const CARGO_TYPES: CargoType[] = [
  "FOOD_BEVERAGE",
  "PERISHABLE",
  "DUTY_FREE",
  "MERCHANDISE",
  "VEHICLE_MAINTENANCE",
];
const CL_ROUTES: ClRoute[] = [
  "STANDARD_OUTBOUND",
  "AIRCRAFT_OUTBOUND",
  "VENDOR_SUPPLY",
  "HUB",
  "REDQ",
  "MAINTENANCE",
  "INBOUND",
];

/**
 * warehouse_pic creates the standard/aircraft/hub/REDQ/maintenance/inbound
 * transaction (CaterLink v2 — "IFC AVSEC Staff" in the handoff spec is
 * this existing role, not a separate driver account). Same
 * whitelist/seal requirements as the legacy icms-airasia Part A form,
 * ported into the fresh cl_transactions/cl_seals tables.
 */
export async function createClTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole(["warehouse_pic"]);

  const route = str(formData, "route") as ClRoute;
  const vehicleNumber = str(formData, "vehicle_number").toUpperCase();
  const driverName = str(formData, "driver_name");
  const driverId = str(formData, "driver_id");
  const vehicleSearchCompleted = bool(formData, "vehicle_search_completed");
  const cargoTypes = formData.getAll("cargo_types").map(String) as CargoType[];
  const seals = parseSealDrafts(str(formData, "seals"));

  if (!CL_ROUTES.includes(route) || route === "VENDOR_SUPPLY") {
    return { error: "Select a valid movement type." };
  }
  if (!vehicleNumber || !driverName || !driverId) {
    return { error: "Vehicle, driver name and driver ID are all required." };
  }
  if (cargoTypes.length === 0 || !cargoTypes.every((c) => CARGO_TYPES.includes(c))) {
    return { error: "Select at least one cargo type." };
  }
  if (!seals) {
    return { error: "Add at least one seal with a number, type and color." };
  }
  if (new Set(seals.map((s) => s.seal_number)).size !== seals.length) {
    return { error: "Duplicate seal numbers — each seal number must be unique." };
  }
  if (!seals.some((s) => s.seal_type === "TRUCK_SEAL")) {
    return { error: "A truck seal is required." };
  }
  if (!vehicleSearchCompleted) {
    return { error: "Vehicle search must be completed before dispatch." };
  }

  const supabase = await createClient();

  // Same hard whitelist block as before — vehicle/driver must already be
  // registered (active) in vehicles/drivers, shared reference tables
  // read-only here (not icms-airasia's operational code/tables).
  const [vehicleRes, driverRes] = await Promise.all([
    supabase.from("vehicles").select("id").eq("vehicle_number", vehicleNumber).eq("is_active", true).maybeSingle(),
    supabase.from("drivers").select("id, name").eq("staff_id", driverId).eq("is_active", true).maybeSingle(),
  ]);
  const unlisted: string[] = [];
  if (!vehicleRes.data) unlisted.push(`vehicle ${vehicleNumber}`);
  if (!driverRes.data) unlisted.push(`driver ${driverId}`);
  if (unlisted.length > 0) {
    return { error: buildWhitelistViolationMessage(unlisted) };
  }
  if (driverRes.data && !namesMatch(driverRes.data.name, driverName)) {
    return {
      error: `WHITELIST_VIOLATION: driver name "${driverName}" does not match the whitelisted name on file for driver ID ${driverId}.`,
    };
  }

  const txId = crypto.randomUUID();
  const { data: tx, error: txError } = await supabase
    .from("cl_transactions")
    .insert({
      id: txId,
      route,
      vehicle_number: vehicleNumber,
      driver_name: driverName,
      driver_id: driverId,
      cargo_types: cargoTypes,
      vehicle_search_completed: vehicleSearchCompleted,
      created_by: profile.id,
      qr_token: generateClQrToken(txId),
    })
    .select()
    .single();

  if (txError || !tx) {
    return { error: `Could not create transaction: ${txError?.message ?? "unknown error"}` };
  }

  const { error: sealsError } = await supabase
    .from("cl_seals")
    .insert(seals.map((s) => ({ ...s, transaction_id: tx.id })));
  if (sealsError) {
    return { error: `Seals could not be saved: ${sealsError.message}` };
  }

  revalidatePath("/");
  redirect(`/${tx.id}/qr?created=1`);
}

/**
 * driver_vendor creates a Vendor Supply transaction — same simple shape
 * as CaterLink v1's vendor Part A (driver name, NRIC-style id, one seal,
 * signature), now writing into cl_transactions/cl_seals instead of the
 * legacy vendor_transactions/vendor_part_a tables.
 */
export async function createVendorSupplyTransaction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireRole(["driver_vendor"]);

  const driverName = str(formData, "driver_name");
  const nricNumber = str(formData, "nric_number");
  const sealNumber = str(formData, "seal_number").toUpperCase();

  if (!driverName || !nricNumber || !sealNumber) {
    return { error: "Driver name, NRIC number and seal number are all required." };
  }

  const supabase = await createClient();
  const txId = crypto.randomUUID();
  const { data: tx, error: txError } = await supabase
    .from("cl_transactions")
    .insert({
      id: txId,
      route: "VENDOR_SUPPLY",
      vehicle_number: "N/A",
      driver_name: driverName,
      driver_id: nricNumber,
      cargo_types: [],
      vehicle_search_completed: true,
      created_by: profile.id,
      qr_token: generateClQrToken(txId),
    })
    .select()
    .single();

  if (txError || !tx) {
    return { error: `Could not create delivery: ${txError?.message ?? "unknown error"}` };
  }

  const { error: sealError } = await supabase.from("cl_seals").insert({
    transaction_id: tx.id,
    seal_number: sealNumber,
    seal_type: "TRUCK_SEAL",
    seal_color: "OTHER",
  });
  if (sealError) {
    return { error: `Seal could not be saved: ${sealError.message}` };
  }

  revalidatePath("/");
  redirect(`/${tx.id}/qr?created=1`);
}

/**
 * The final AVSEC sign-off — whichever role ROUTE_SIGNOFF_ROLE maps the
 * transaction's route to. The DB trigger (cl_enforce_signoff) is the
 * real authority on the role match and CREATED status; this action's
 * own check is just a friendlier error before hitting the DB.
 */
export async function signOffClTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();

  const transactionId = str(formData, "transaction_id");
  const signature = str(formData, "signature");
  if (!transactionId) return { error: "Missing transaction reference." };
  if (!signature) return { error: "Signature is required." };

  const supabase = await createClient();
  const { data: txRow } = await supabase
    .from("cl_transactions")
    .select("*")
    .eq("id", transactionId)
    .single();
  if (!txRow) return { error: "Transaction not found." };

  const requiredRole = ROUTE_SIGNOFF_ROLE[txRow.route];
  if (profile.role !== requiredRole) {
    return { error: `Only ${requiredRole} may sign off this transaction (route: ${txRow.route}).` };
  }
  if (txRow.status !== "CREATED") {
    return { error: `This transaction is already ${txRow.status}.` };
  }

  let sig: { path: string };
  try {
    sig = await uploadDataUrl("signatures", signature, "cl-signoffs");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Signature upload failed." };
  }

  const { error: signoffError } = await supabase.from("cl_signoffs").insert({
    transaction_id: transactionId,
    signer_id: profile.id,
    signer_role: profile.role,
    signature_url: sig.path,
  });
  if (signoffError) {
    return { error: `Could not record sign-off: ${signoffError.message}` };
  }

  const { data: seals } = await supabase.from("cl_seals").select("*").eq("transaction_id", transactionId);

  const pdfBytes = await generateClCompletionPdf({
    referenceNumber: txRow.reference_number,
    route: txRow.route,
    vehicleNumber: txRow.vehicle_number,
    driverName: txRow.driver_name,
    driverId: txRow.driver_id,
    seals: (seals ?? []) as ClSeal[],
    signerName: profile.name,
    signerRole: profile.role,
    signaturePath: sig.path,
    signedAt: new Date().toISOString(),
  });

  const pdfPath = await uploadPdfBuffer("completed-forms", pdfBytes, "cl-completed-forms");
  await supabase.from("cl_transactions").update({ completed_form_url: pdfPath }).eq("id", transactionId);

  revalidatePath(`/${transactionId}`);
  revalidatePath("/");
  redirect(`/${transactionId}?completed=1`);
}

/**
 * Cancels a CREATED transaction (failed vehicle search, vendor no-show,
 * etc). The security-definer cl_cancel_transaction() DB function is the
 * real authority — it re-checks that the caller is either the creator or
 * a supervisor and that the transaction is still CREATED, so this action's
 * own role check is just a friendlier error before hitting the DB.
 */
export async function cancelClTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();

  const transactionId = str(formData, "transaction_id");
  const reason = str(formData, "reason");
  if (!transactionId) return { error: "Missing transaction reference." };
  if (!reason) return { error: "A cancellation reason is required." };

  const supabase = await createClient();
  const { data: txRow } = await supabase
    .from("cl_transactions")
    .select("status, created_by")
    .eq("id", transactionId)
    .single();
  if (!txRow) return { error: "Transaction not found." };
  if (txRow.status !== "CREATED") {
    return { error: `This transaction is already ${txRow.status}.` };
  }
  if (txRow.created_by !== profile.id && profile.role !== "supervisor") {
    return { error: "Only the creator or an Admin can cancel this transaction." };
  }

  const { error } = await supabase.rpc("cl_cancel_transaction", {
    p_transaction_id: transactionId,
    p_reason: reason,
  });
  if (error) {
    return { error: `Could not cancel transaction: ${error.message}` };
  }

  revalidatePath(`/${transactionId}`);
  revalidatePath("/");
  redirect(`/${transactionId}?cancelled=1`);
}
