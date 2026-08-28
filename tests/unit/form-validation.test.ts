import { describe, expect, it } from "vitest";
import { getMissingTransactionRequirements } from "@/lib/form-validation";

/**
 * Covers the /new checkbox-validation fix: the submit button being merely
 * "disabled" was invisible feedback when a checkbox's DOM/a11y state
 * drifted from React state (autofill, programmatic toggles). This is the
 * logic behind the visible summary shown next to the submit button.
 */
describe("getMissingTransactionRequirements", () => {
  const complete = {
    route: "STANDARD_OUTBOUND",
    cargoTypesCount: 1,
    sealsReady: true,
    vehicleSearchCompleted: true,
  };

  it("returns no missing requirements when everything is satisfied", () => {
    expect(getMissingTransactionRequirements(complete)).toEqual([]);
  });

  it("flags a missing movement type", () => {
    const missing = getMissingTransactionRequirements({ ...complete, route: "" });
    expect(missing).toContain("a movement type");
  });

  it("flags zero cargo types selected", () => {
    const missing = getMissingTransactionRequirements({ ...complete, cargoTypesCount: 0 });
    expect(missing).toContain("at least one cargo type");
  });

  it("flags incomplete seal details", () => {
    const missing = getMissingTransactionRequirements({ ...complete, sealsReady: false });
    expect(missing).toContain("valid seal details (number and color for every seal)");
  });

  it("flags the vehicle-search checklist when unchecked — the checkbox-state case", () => {
    const missing = getMissingTransactionRequirements({ ...complete, vehicleSearchCompleted: false });
    expect(missing).toContain("the vehicle search checklist");
  });

  it("reports every unmet requirement at once, not just the first", () => {
    const missing = getMissingTransactionRequirements({
      route: "",
      cargoTypesCount: 0,
      sealsReady: false,
      vehicleSearchCompleted: false,
    });
    expect(missing).toHaveLength(4);
  });
});
