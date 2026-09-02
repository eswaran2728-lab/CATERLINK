import type { SealColor, SealType } from "./database.types";

/**
 * Pure helpers shared by the transaction-creation server actions (which
 * live in "use server" files — Next.js requires those to export only
 * async server actions, so this logic lives here instead) so they can
 * also be unit tested directly.
 */

export const SEAL_TYPES: SealType[] = ["TRUCK_SEAL", "TROLLEY", "OTHER"];
export const SEAL_COLORS: SealColor[] = ["BLUE", "GREEN", "OTHER"];

export interface SealDraftInput {
  seal_number: string;
  seal_type: SealType;
  seal_color: SealColor;
}

/** Parses and validates the JSON seal-drafts payload submitted by the transaction form. */
export function parseSealDrafts(raw: string): SealDraftInput[] | null {
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

/** Case/whitespace-insensitive name comparison used for the whitelist check. */
export function namesMatch(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

/** Builds the WHITELIST_VIOLATION message for whichever of vehicle/driver isn't whitelisted. */
export function buildWhitelistViolationMessage(unlisted: string[]): string {
  return `WHITELIST_VIOLATION: ${unlisted.join(" and ")} not on the active whitelist. Ask an Admin to add this vehicle/driver first.`;
}
