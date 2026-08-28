import { describe, expect, it } from "vitest";
import { buildWhitelistViolationMessage } from "@/lib/seal-parsing";

describe("buildWhitelistViolationMessage", () => {
  it("names the vehicle when only the vehicle is unlisted", () => {
    const msg = buildWhitelistViolationMessage(["vehicle BPU 6107"]);
    expect(msg).toContain("WHITELIST_VIOLATION:");
    expect(msg).toContain("vehicle BPU 6107 not on the active whitelist");
  });

  it("names both when vehicle and driver are unlisted", () => {
    const msg = buildWhitelistViolationMessage(["vehicle BPU 6107", "driver 1001099"]);
    expect(msg).toContain("vehicle BPU 6107 and driver 1001099 not on the active whitelist");
  });
});
