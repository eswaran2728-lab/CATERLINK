import { describe, expect, it } from "vitest";
import { MOVEMENT_TYPES, movementTypeToDirectionRoute } from "@/lib/constants";

/**
 * Regression guard for the direction/route pair CaterLink sends to
 * VECTA's transactions table. MAINTENANCE must map to route='MAINTENANCE'
 * directly (not 'AIRCRAFT' + a cargo type, despite what a since-corrected
 * reading of the integration contract implied) — verified against the
 * live transactions_maintenance_cargo_pairing CHECK constraint and
 * enforce_part_sequence()'s MAINTENANCE branch, which both require the
 * stored route to already be 'MAINTENANCE'.
 */
describe("movementTypeToDirectionRoute", () => {
  it("maps every movement type to a valid direction/route pair", () => {
    for (const type of MOVEMENT_TYPES) {
      const { direction, route } = movementTypeToDirectionRoute(type);
      expect(["OUTBOUND", "INBOUND"]).toContain(direction);
      expect(["AIRCRAFT", "HUB", "REDQ", "MAINTENANCE"]).toContain(route);
    }
  });

  it("OUTBOUND -> AIRCRAFT/OUTBOUND", () => {
    expect(movementTypeToDirectionRoute("OUTBOUND")).toEqual({ direction: "OUTBOUND", route: "AIRCRAFT" });
  });

  it("INBOUND -> AIRCRAFT/INBOUND", () => {
    expect(movementTypeToDirectionRoute("INBOUND")).toEqual({ direction: "INBOUND", route: "AIRCRAFT" });
  });

  it("HUB -> HUB/OUTBOUND", () => {
    expect(movementTypeToDirectionRoute("HUB")).toEqual({ direction: "OUTBOUND", route: "HUB" });
  });

  it("REDQ -> REDQ/OUTBOUND", () => {
    expect(movementTypeToDirectionRoute("REDQ")).toEqual({ direction: "OUTBOUND", route: "REDQ" });
  });

  it("MAINTENANCE -> MAINTENANCE/OUTBOUND (sent directly, not derived)", () => {
    expect(movementTypeToDirectionRoute("MAINTENANCE")).toEqual({ direction: "OUTBOUND", route: "MAINTENANCE" });
  });
});
