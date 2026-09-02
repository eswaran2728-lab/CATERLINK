"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { uploadDataUrl } from "@/lib/storage";
import { mintQrToken } from "@/lib/vecta-api";
import { movementTypeToDirectionRoute, type MovementType } from "@/lib/constants";
import { parseSealDrafts, namesMatch, buildWhitelistViolationMessage } from "@/lib/seal-parsing";
import { parseNonNegativeInt, getMissingIfcsfFormAFields } from "@/lib/form-a-validation";
import type { CargoType, HubDestination } from "@/lib/database.types";

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
const MOVEMENT_TYPES: MovementType[] = ["OUTBOUND", "INBOUND", "HUB", "REDQ", "MAINTENANCE"];
const HUB_DESTINATIONS: HubDestination[] = ["PEN", "JHB", "NILAI"];

/**
 * warehouse_pic creates the IFCSF (AA/SEC/F/010) movement — writes
 * directly into VECTA's own transactions/part_a/seals tables per the
 * CaterLink<->VECTA Forms Integration Contract (VECTA owns Parts B/C/D
 * entirely; CaterLink only creates the row + Part A + the QR pass).
 */
export async function createTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole(["warehouse_pic"]);

  const movementType = str(formData, "movement_type") as MovementType;
  const vehicleNumber = str(formData, "vehicle_number").toUpperCase();
  const driverName = str(formData, "driver_name");
  const driverId = str(formData, "driver_id");
  const vehicleSearchCompleted = bool(formData, "vehicle_search_completed");
  const cargoTypes = formData.getAll("cargo_types").map(String) as CargoType[];
  const seals = parseSealDrafts(str(formData, "seals"));
  const hubDestination = str(formData, "hub_destination") as HubDestination | "";

  const station = str(formData, "station");
  const carts = str(formData, "carts");
  const smu = str(formData, "smu");
  const pallets = str(formData, "pallets");
  const boxes = str(formData, "boxes");
  const ovenRack = str(formData, "oven_rack");
  const picName = str(formData, "pic_name");
  const picStaffId = str(formData, "pic_staff_id");
  const signature = str(formData, "signature");

  if (!MOVEMENT_TYPES.includes(movementType)) {
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
  if (movementType === "HUB" && !HUB_DESTINATIONS.includes(hubDestination as HubDestination)) {
    return { error: "Select a hub destination." };
  }

  const missingFormA = getMissingIfcsfFormAFields({
    station,
    carts,
    smu,
    pallets,
    boxes,
    ovenRack,
    certifyingName: picName,
    certifyingId: picStaffId,
    hasSignature: signature.length > 0,
  });
  if (missingFormA.length > 0) {
    return { error: `Complete Part A of the IFCSF form: ${missingFormA.join(", ")}.` };
  }

  // MAINTENANCE movements must carry the Vehicle Maintenance cargo type —
  // the DB's transactions_maintenance_cargo_pairing CHECK requires it.
  const finalCargoTypes =
    movementType === "MAINTENANCE" && !cargoTypes.includes("VEHICLE_MAINTENANCE")
      ? [...cargoTypes, "VEHICLE_MAINTENANCE" as CargoType]
      : cargoTypes;

  const supabase = await createClient();

  // Friendly pre-check before the DB's own enforce_whitelist_on_create()
  // trigger rejects the insert — same whitelist semantics, just a nicer
  // error message and the vehicle_id/driver_id_ref the trigger requires.
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

  const { direction, route } = movementTypeToDirectionRoute(movementType);
  const truckSeal = seals.find((s) => s.seal_type === "TRUCK_SEAL")!;
  const cartsN = parseNonNegativeInt(carts) ?? 0;
  const smuN = parseNonNegativeInt(smu) ?? 0;
  const palletsN = parseNonNegativeInt(pallets) ?? 0;
  const boxesN = parseNonNegativeInt(boxes) ?? 0;
  const ovenRackN = parseNonNegativeInt(ovenRack) ?? 0;

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      direction,
      route,
      hub_destination: movementType === "HUB" ? (hubDestination as HubDestination) : null,
      station,
      vehicle_number: vehicleNumber,
      driver_name: driverName,
      driver_id: driverId,
      vehicle_id: vehicleRes.data!.id,
      driver_id_ref: driverRes.data!.id,
      seal_number: truckSeal.seal_number,
      cargo_types: finalCargoTypes,
      supplies_carts: cartsN,
      supplies_smu: smuN,
      supplies_pallets: palletsN,
      supplies_boxes: boxesN,
      supplies_oven_racks: ovenRackN,
      supplies_total: cartsN + smuN + palletsN + boxesN + ovenRackN,
      created_by: profile.id,
    })
    .select()
    .single();

  if (txError || !tx) {
    return { error: `Could not create transaction: ${txError?.message ?? "unknown error"}` };
  }

  const { error: sealsError } = await supabase
    .from("seals")
    .insert(seals.map((s) => ({ ...s, transaction_id: tx.id })));
  if (sealsError) {
    return { error: `Seals could not be saved: ${sealsError.message}` };
  }

  let signaturePath: string;
  try {
    signaturePath = (await uploadDataUrl("signatures", signature, "part-a")).path;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Signature upload failed." };
  }

  const { error: partAError } = await supabase.from("part_a").insert({
    transaction_id: tx.id,
    pic_name: picName,
    pic_staff_id: picStaffId,
    vehicle_search_completed: vehicleSearchCompleted,
    signature_url: signaturePath,
    signature_hash: null,
    remarks: null,
    completed_by: profile.id,
  });
  if (partAError) {
    return { error: `Part A could not be saved: ${partAError.message}` };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { error: "Session expired — please sign in again before creating a transaction." };
  }

  try {
    const qrToken = await mintQrToken({ transactionId: tx.id, type: "CATERING", accessToken: session.access_token });
    await supabase.from("transactions").update({ qr_token: qrToken }).eq("id", tx.id);
  } catch (e) {
    return {
      error:
        (e instanceof Error ? e.message : "Could not mint the QR pass.") +
        ` The transaction was created (${tx.transaction_number}) — open it from Home to retry the QR pass.`,
    };
  }

  revalidatePath("/");
  redirect(`/${tx.id}/qr?created=1`);
}
