"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { uploadDataUrl } from "@/lib/storage";
import { generateQrToken } from "@/lib/qr-token";
import type {
  CargoType,
  Direction,
  HubDestination,
  SealColor,
  SealType,
  TransactionRoute,
} from "@/lib/database.types";

interface SealDraftInput {
  seal_number: string;
  seal_type: SealType;
  seal_color: SealColor;
}

const SEAL_TYPES: SealType[] = ["TRUCK_SEAL", "TROLLEY", "OTHER"];
const SEAL_COLORS: SealColor[] = ["BLUE", "GREEN", "OTHER"];
const CARGO_TYPES: CargoType[] = [
  "FOOD_BEVERAGE",
  "PERISHABLE",
  "DUTY_FREE",
  "MERCHANDISE",
  "VEHICLE_MAINTENANCE",
];

function parseSealDrafts(raw: string): SealDraftInput[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const seals: SealDraftInput[] = [];
    for (const item of parsed) {
      const number = String(item?.seal_number ?? "").trim().toUpperCase();
      const type = String(item?.seal_type ?? "") as SealType;
      const color = String(item?.seal_color ?? "") as SealColor;
      if (!number || !SEAL_TYPES.includes(type) || !SEAL_COLORS.includes(color)) return null;
      seals.push({ seal_number: number, seal_type: type, seal_color: color });
    }
    return seals;
  } catch {
    return null;
  }
}

export interface ActionState {
  error: string | null;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

/** Non-negative integer, or null when the field was left blank. */
function optionalInt(formData: FormData, key: string): number | null {
  const raw = str(formData, key);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

/**
 * ICMS inbound/outbound transaction, Part A. Ported from icms-airasia's
 * createTransaction (src/lib/actions/transactions.ts) — same table
 * (`transactions`/`part_a`/`seals`), same whitelist/seal/cargo-type
 * requirements, so VECTA's existing Part B/C/D verification flow reads
 * it unchanged. Only the caller role differs: driver_ifc here instead of
 * icms-airasia's warehouse_pic (an IFC driver using CaterLink is their
 * own Part A "PIC" — see the driver_ifc RLS policies added on top of the
 * already-applied ICMS schema).
 */
export async function createTransaction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireRole(["driver_ifc"]);

  const direction = str(formData, "direction") as Direction;
  const vehicleNumber = str(formData, "vehicle_number").toUpperCase();
  const driverName = str(formData, "driver_name");
  const driverId = str(formData, "driver_id");
  const remarks = str(formData, "remarks");
  const vehicleSearchCompleted = bool(formData, "vehicle_search_completed");
  const signature = str(formData, "signature");
  const seals = parseSealDrafts(str(formData, "seals"));
  const flightNumber = str(formData, "flight_number").toUpperCase();
  const aircraftRegistration = str(formData, "aircraft_registration").toUpperCase();
  const station = str(formData, "station").toUpperCase();
  const cargoTypes = formData.getAll("cargo_types").map(String) as CargoType[];
  const suppliesTotal = optionalInt(formData, "supplies_total");
  const suppliesCarts = optionalInt(formData, "supplies_carts");
  const suppliesSmu = optionalInt(formData, "supplies_smu");
  const suppliesPallets = optionalInt(formData, "supplies_pallets");
  const suppliesBoxes = optionalInt(formData, "supplies_boxes");
  const suppliesOvenRacks = optionalInt(formData, "supplies_oven_racks");

  const route = (str(formData, "route") || "AIRCRAFT") as TransactionRoute;
  const hubDestination = (str(formData, "hub_destination") || null) as HubDestination | null;

  if (direction !== "OUTBOUND" && direction !== "INBOUND") {
    return { error: "Select a direction (Outbound or Inbound). / Pilih arah (Keluar atau Masuk)." };
  }
  if (!["AIRCRAFT", "HUB", "REDQ"].includes(route)) {
    return { error: "Invalid route selected." };
  }
  if ((route === "HUB" || route === "REDQ") && direction !== "OUTBOUND") {
    return {
      error: "Hub and REDQ → FOB are outbound-only routes. / Hub dan REDQ → FOB adalah laluan keluar sahaja.",
    };
  }
  if (route === "HUB" && !hubDestination) {
    return { error: "Select a hub destination. / Pilih destinasi hab." };
  }
  if (route === "HUB" && !["PEN", "JHB", "NILAI"].includes(hubDestination as string)) {
    return { error: "Invalid hub destination selected." };
  }
  if (route !== "HUB" && hubDestination) {
    return { error: "Hub destination only applies to the Hub route." };
  }
  if (!vehicleNumber || !driverName || !driverId) {
    return { error: "Vehicle, driver and driver ID are all required." };
  }
  if (!station) {
    return { error: "Station is required. / Stesen diperlukan." };
  }
  if (cargoTypes.length === 0 || !cargoTypes.every((c) => CARGO_TYPES.includes(c))) {
    return { error: "Select at least one cargo type. / Pilih sekurang-kurangnya satu jenis kargo." };
  }

  const effectiveRoute: TransactionRoute =
    route === "AIRCRAFT" && direction === "OUTBOUND" && cargoTypes.includes("VEHICLE_MAINTENANCE")
      ? "MAINTENANCE"
      : route;

  if (!seals) {
    return { error: "Add at least one seal with a number, type and color." };
  }
  if (new Set(seals.map((s) => s.seal_number)).size !== seals.length) {
    return { error: "Duplicate seal numbers — each seal number must be unique." };
  }
  const truckSeals = seals.filter((s) => s.seal_type === "TRUCK_SEAL");
  if (truckSeals.length === 0) {
    return { error: "A truck seal is required. / Sil trak diperlukan." };
  }
  if (!vehicleSearchCompleted) {
    return { error: "Vehicle search must be completed before dispatch." };
  }
  if (!signature) {
    return { error: "Signature is required." };
  }

  const supabase = await createClient();

  // Same hard whitelist block as icms-airasia: vehicle/driver must already
  // be registered (active) in vehicles/drivers, or the DB trigger
  // (enforce_whitelist_on_create) rejects the insert anyway. Checked here
  // first for a friendlier error message.
  const today = new Date().toISOString().slice(0, 10);
  const [vehicleRes, driverRes] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, pass_expiry_date, is_active")
      .eq("vehicle_number", vehicleNumber)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("drivers")
      .select("id, name, pass_expiry_date, is_active")
      .eq("staff_id", driverId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  const vehicleRec = vehicleRes.data;
  const driverRec = driverRes.data;

  const expiredItems: string[] = [];
  if (vehicleRec?.pass_expiry_date && vehicleRec.pass_expiry_date < today) {
    expiredItems.push(`vehicle ${vehicleNumber}`);
  }
  if (driverRec?.pass_expiry_date && driverRec.pass_expiry_date < today) {
    expiredItems.push(`driver ${driverId}`);
  }
  if (expiredItems.length > 0) {
    return {
      error:
        `EXPIRED_PASS: airport pass expired for ${expiredItems.join(" and ")}. ` +
        `The vehicle must not proceed. Ask an Admin to renew the pass before creating this transaction. ` +
        `/ Pas lapangan terbang telah tamat tempoh.`,
    };
  }

  const unlisted: string[] = [];
  if (!vehicleRec) unlisted.push(`vehicle ${vehicleNumber}`);
  if (!driverRec) unlisted.push(`driver ${driverId}`);
  if (unlisted.length > 0) {
    return {
      error:
        `WHITELIST_VIOLATION: ${unlisted.join(" and ")} not on the active whitelist. Ask an Admin to add ` +
        `this vehicle/driver to the whitelist before creating this transaction. ` +
        `/ Tiada dalam senarai putih aktif — hubungi Admin untuk menambah kenderaan/pemandu ini sebelum mencipta transaksi.`,
    };
  }
  if (driverRec && driverRec.name.trim().toUpperCase() !== driverName.trim().toUpperCase()) {
    return {
      error:
        `WHITELIST_VIOLATION: driver name "${driverName}" does not match the whitelisted name on file for ` +
        `driver ID ${driverId}. Enter the driver's registered name exactly. ` +
        `/ Nama pemandu tidak sepadan dengan nama dalam senarai putih untuk ID pemandu ini.`,
    };
  }

  let sig: { path: string; sha256: string };
  try {
    sig = await uploadDataUrl("signatures", signature, "part-a");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Signature upload failed." };
  }

  const txId = crypto.randomUUID();
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      id: txId,
      direction,
      route: effectiveRoute,
      hub_destination: hubDestination,
      vehicle_number: vehicleNumber,
      driver_name: driverName,
      driver_id: driverId,
      seal_number: null,
      created_by: profile.id,
      qr_token: generateQrToken(txId),
      flight_number: flightNumber || null,
      aircraft_registration: aircraftRegistration || null,
      catering_company_id: null,
      vehicle_id: vehicleRec?.id ?? null,
      driver_id_ref: driverRec?.id ?? null,
      trolley_count: 0,
      escort_officer_name: null,
      escort_officer_staff_id: null,
      escort_vehicle_number: null,
      station,
      cargo_types: cargoTypes,
      supplies_total: suppliesTotal,
      supplies_carts: suppliesCarts,
      supplies_smu: suppliesSmu,
      supplies_pallets: suppliesPallets,
      supplies_boxes: suppliesBoxes,
      supplies_oven_racks: suppliesOvenRacks,
    })
    .select()
    .single();

  if (txError || !tx) {
    return { error: `Could not create transaction: ${txError?.message ?? "unknown error"}` };
  }

  const { error: partError } = await supabase.from("part_a").insert({
    transaction_id: tx.id,
    pic_name: profile.name,
    pic_staff_id: profile.staff_id,
    vehicle_search_completed: vehicleSearchCompleted,
    signature_url: sig.path,
    signature_hash: sig.sha256,
    remarks: remarks || null,
    completed_by: profile.id,
  });

  if (partError) {
    return { error: `Part A could not be saved: ${partError.message}` };
  }

  const { error: sealsError } = await supabase
    .from("seals")
    .insert(seals.map((s) => ({ ...s, transaction_id: tx.id })));
  if (sealsError) {
    return { error: `Seals could not be saved: ${sealsError.message}` };
  }

  revalidatePath("/");
  redirect(`/${tx.id}/qr?created=1`);
}
