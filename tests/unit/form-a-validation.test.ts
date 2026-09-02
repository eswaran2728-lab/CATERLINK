import { describe, expect, it } from "vitest";
import {
  parseNonNegativeInt,
  getMissingIfcsfFormAFields,
  getMissingVendorFormAFields,
  type IfcsfFormAFields,
  type VendorFormAFields,
} from "@/lib/form-a-validation";

describe("parseNonNegativeInt", () => {
  it("accepts zero", () => {
    expect(parseNonNegativeInt("0")).toBe(0);
  });

  it("accepts a positive integer", () => {
    expect(parseNonNegativeInt("42")).toBe(42);
  });

  it("rejects a negative number", () => {
    expect(parseNonNegativeInt("-1")).toBeNull();
  });

  it("rejects empty input — a count must be explicitly entered", () => {
    expect(parseNonNegativeInt("")).toBeNull();
    expect(parseNonNegativeInt("   ")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseNonNegativeInt("abc")).toBeNull();
  });

  it("rejects a decimal", () => {
    expect(parseNonNegativeInt("1.5")).toBeNull();
  });
});

const completeIfcsf: IfcsfFormAFields = {
  station: "KUL",
  carts: "2",
  smu: "0",
  pallets: "1",
  boxes: "3",
  ovenRack: "0",
  certifyingName: "Ahmad bin Ismail",
  certifyingId: "1001099",
  hasSignature: true,
};

describe("getMissingIfcsfFormAFields — Outbound and Inbound share the same Part A fields", () => {
  it("is satisfied when every field is present and every count is >= 0", () => {
    expect(getMissingIfcsfFormAFields(completeIfcsf)).toEqual([]);
  });

  it("flags a missing station", () => {
    expect(getMissingIfcsfFormAFields({ ...completeIfcsf, station: "" })).toContain("station");
  });

  it("flags a negative count field instead of silently accepting it", () => {
    const missing = getMissingIfcsfFormAFields({ ...completeIfcsf, boxes: "-5" });
    expect(missing).toContain("boxes count");
  });

  it("flags an empty count field (zero must be entered explicitly, not left blank)", () => {
    const missing = getMissingIfcsfFormAFields({ ...completeIfcsf, carts: "" });
    expect(missing).toContain("carts count");
  });

  it("flags a missing certifying name and ID", () => {
    const missing = getMissingIfcsfFormAFields({ ...completeIfcsf, certifyingName: "", certifyingId: "" });
    expect(missing).toContain("certifying staff name");
    expect(missing).toContain("certifying staff ID");
  });

  it("flags a missing signature", () => {
    const missing = getMissingIfcsfFormAFields({ ...completeIfcsf, hasSignature: false });
    expect(missing).toContain("signature");
  });

  it("reports every unmet field at once for a completely empty form", () => {
    const missing = getMissingIfcsfFormAFields({
      station: "",
      carts: "",
      smu: "",
      pallets: "",
      boxes: "",
      ovenRack: "",
      certifyingName: "",
      certifyingId: "",
      hasSignature: false,
    });
    expect(missing).toHaveLength(9);
  });
});

const completeVendor: VendorFormAFields = {
  suppliesDescription: "2 carts, 3 bins",
  hasSignature: true,
};

describe("getMissingVendorFormAFields — Vendor Supply Part A only needs supplies + signature", () => {
  it("is satisfied when both fields are present", () => {
    expect(getMissingVendorFormAFields(completeVendor)).toEqual([]);
  });

  it("flags a missing supplies description", () => {
    expect(getMissingVendorFormAFields({ ...completeVendor, suppliesDescription: "" })).toContain(
      "in-flight supplies (carts/containers/bins)"
    );
  });

  it("flags a missing signature", () => {
    expect(getMissingVendorFormAFields({ ...completeVendor, hasSignature: false })).toContain("signature");
  });

  it("does not require IFCSF-only fields like station or counts", () => {
    const missing = getMissingVendorFormAFields(completeVendor);
    expect(missing.join(" ")).not.toContain("station");
    expect(missing.join(" ")).not.toContain("carts count");
  });
});
