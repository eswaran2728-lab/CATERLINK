/**
 * Pure validation helpers shared between the transaction-creation form and
 * its tests. Kept separate from transaction-form.tsx (a client component)
 * so the logic behind the submit-button's disabled state and the visible
 * "what's missing" summary can be unit tested without rendering React.
 */

export interface TransactionFormFields {
  route: string;
  cargoTypesCount: number;
  sealsReady: boolean;
  vehicleSearchCompleted: boolean;
}

/**
 * Returns a human-readable list of what's still required before the
 * transaction-creation form can be submitted. Empty array means ready.
 */
export function getMissingTransactionRequirements(fields: TransactionFormFields): string[] {
  const missing: string[] = [];
  if (!fields.route) missing.push("a movement type");
  if (fields.cargoTypesCount === 0) missing.push("at least one cargo type");
  if (!fields.sealsReady) missing.push("valid seal details (number and color for every seal)");
  if (!fields.vehicleSearchCompleted) missing.push("the vehicle search checklist");
  return missing;
}
