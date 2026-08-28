import { describe, expect, it } from "vitest";
import { parseSealDrafts, namesMatch } from "@/lib/seal-parsing";

describe("parseSealDrafts", () => {
  it("parses a valid single-seal payload", () => {
    const result = parseSealDrafts(
      JSON.stringify([{ seal_number: "abc123", seal_type: "TRUCK_SEAL", seal_color: "BLUE" }])
    );
    expect(result).toEqual([{ seal_number: "ABC123", seal_type: "TRUCK_SEAL", seal_color: "BLUE" }]);
  });

  it("parses multiple seals", () => {
    const result = parseSealDrafts(
      JSON.stringify([
        { seal_number: "a1", seal_type: "TRUCK_SEAL", seal_color: "BLUE" },
        { seal_number: "b2", seal_type: "TROLLEY", seal_color: "GREEN" },
      ])
    );
    expect(result).toHaveLength(2);
  });

  it("rejects an empty array", () => {
    expect(parseSealDrafts(JSON.stringify([]))).toBeNull();
  });

  it("rejects malformed JSON", () => {
    expect(parseSealDrafts("not json")).toBeNull();
  });

  it("rejects a seal missing a number", () => {
    expect(parseSealDrafts(JSON.stringify([{ seal_number: "", seal_type: "TRUCK_SEAL", seal_color: "BLUE" }]))).toBeNull();
  });

  it("rejects an invalid seal type", () => {
    expect(
      parseSealDrafts(JSON.stringify([{ seal_number: "a1", seal_type: "BOGUS", seal_color: "BLUE" }]))
    ).toBeNull();
  });

  it("rejects an invalid seal color", () => {
    expect(
      parseSealDrafts(JSON.stringify([{ seal_number: "a1", seal_type: "TRUCK_SEAL", seal_color: "PURPLE" }]))
    ).toBeNull();
  });
});

describe("namesMatch", () => {
  it("matches identical names", () => {
    expect(namesMatch("Ahmad bin Ismail", "Ahmad bin Ismail")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(namesMatch("ahmad bin ismail", "AHMAD BIN ISMAIL")).toBe(true);
  });

  it("ignores leading/trailing whitespace", () => {
    expect(namesMatch("  Ahmad bin Ismail  ", "Ahmad bin Ismail")).toBe(true);
  });

  it("rejects a genuinely different name", () => {
    expect(namesMatch("Ahmad bin Ismail", "Muthu a/l Samy")).toBe(false);
  });
});
