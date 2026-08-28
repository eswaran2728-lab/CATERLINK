import { describe, expect, it } from "vitest";
import { CL_CREATABLE_ROUTES, ROUTE_SIGNOFF_ROLE } from "@/lib/constants";
import type { ClRoute, Role } from "@/lib/database.types";

/**
 * The real authority for role-matching is the cl_enforce_signoff() Postgres
 * trigger (supabase/migrations/20260819000004_caterlink_v2_schema.sql) —
 * this app-side copy only drives UI hints ("needs your sign-off", etc).
 * This test is a regression guard: if either copy is edited without the
 * other, a route would show the wrong "needs your sign-off" badge even
 * though the DB would still enforce the correct signer.
 *
 * The trigger's own behavior (rejecting a mismatched signer_role and
 * flipping status to COMPLETED for a matching one) was verified live
 * against the vecta-prod database in a rolled-back transaction — see
 * tests/README.md for the exact queries used and their results.
 */
const TRIGGER_ROUTE_SIGNOFF_ROLE: Record<ClRoute, Role> = {
  VENDOR_SUPPLY: "post2_avsec",
  MAINTENANCE: "post6_avsec",
  HUB: "hub_avsec",
  STANDARD_OUTBOUND: "receiver",
  AIRCRAFT_OUTBOUND: "receiver",
  REDQ: "receiver",
  INBOUND: "receiver",
};

describe("ROUTE_SIGNOFF_ROLE", () => {
  it("matches the cl_enforce_signoff() trigger's role mapping exactly, for every route", () => {
    expect(ROUTE_SIGNOFF_ROLE).toEqual(TRIGGER_ROUTE_SIGNOFF_ROLE);
  });

  it("covers all 7 routes the DB check constraint allows", () => {
    const allRoutes: ClRoute[] = [
      "STANDARD_OUTBOUND",
      "AIRCRAFT_OUTBOUND",
      "VENDOR_SUPPLY",
      "HUB",
      "REDQ",
      "MAINTENANCE",
      "INBOUND",
    ];
    for (const route of allRoutes) {
      expect(ROUTE_SIGNOFF_ROLE[route]).toBeDefined();
    }
  });
});

describe("CL_CREATABLE_ROUTES", () => {
  it("lists exactly the 6 movement types a warehouse_pic picks when creating", () => {
    expect(CL_CREATABLE_ROUTES).toHaveLength(6);
    expect(CL_CREATABLE_ROUTES).toEqual(
      expect.arrayContaining([
        "STANDARD_OUTBOUND",
        "AIRCRAFT_OUTBOUND",
        "HUB",
        "REDQ",
        "MAINTENANCE",
        "INBOUND",
      ])
    );
  });

  it("excludes VENDOR_SUPPLY — that route is only ever set server-side for driver_vendor", () => {
    expect(CL_CREATABLE_ROUTES).not.toContain("VENDOR_SUPPLY");
  });
});
