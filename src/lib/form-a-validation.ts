/**
 * Pure validation for Part A of the two paper AVSEC forms (AA/SEC/F/010
 * IFCSF, AA/SEC/F/019 Vendor Supplies), shared between the /new form UI
 * (for a live "what's missing" summary) and its tests. The DB-side
 * cl_enforce_form_a() trigger is the real authority — this is the
 * friendlier, earlier check.
 */

/** Parses a count field: empty is invalid (must be an explicit 0+), negative is invalid. */
export function parseNonNegativeInt(raw: string): number | null {
  if (raw.trim() === "") return null;
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export interface IfcsfFormAFields {
  station: string;
  carts: string;
  smu: string;
  pallets: string;
  boxes: string;
  ovenRack: string;
  certifyingName: string;
  certifyingId: string;
  hasSignature: boolean;
}

/** IFCSF Part A (Outbound + Inbound share the same required fields). */
export function getMissingIfcsfFormAFields(fields: IfcsfFormAFields): string[] {
  const missing: string[] = [];
  if (!fields.station.trim()) missing.push("station");
  if (parseNonNegativeInt(fields.carts) === null) missing.push("carts count");
  if (parseNonNegativeInt(fields.smu) === null) missing.push("SMU count");
  if (parseNonNegativeInt(fields.pallets) === null) missing.push("pallets count");
  if (parseNonNegativeInt(fields.boxes) === null) missing.push("boxes count");
  if (parseNonNegativeInt(fields.ovenRack) === null) missing.push("oven rack count");
  if (!fields.certifyingName.trim()) missing.push("certifying staff name");
  if (!fields.certifyingId.trim()) missing.push("certifying staff ID");
  if (!fields.hasSignature) missing.push("signature");
  return missing;
}

export interface VendorFormAFields {
  suppliesDescription: string;
  hasSignature: boolean;
}

/** Vendor Supplies Part A — driver name/NRIC/seal are already required elsewhere on the same form. */
export function getMissingVendorFormAFields(fields: VendorFormAFields): string[] {
  const missing: string[] = [];
  if (!fields.suppliesDescription.trim()) missing.push("in-flight supplies (carts/containers/bins)");
  if (!fields.hasSignature) missing.push("signature");
  return missing;
}
