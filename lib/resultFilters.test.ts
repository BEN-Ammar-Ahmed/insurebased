import { describe, expect, it } from "vitest";
import { applyResultFilters, parseWithin } from "./resultFilters";

describe("parseWithin", () => {
  it("accepts the offered distances only", () => {
    expect(parseWithin("5")).toBe(5);
    expect(parseWithin("1")).toBe(1);
    expect(parseWithin("7")).toBeNull();
    expect(parseWithin("abc")).toBeNull();
    expect(parseWithin(null)).toBeNull();
  });
});

describe("applyResultFilters", () => {
  const doctors = [
    { id: "a", distanceMi: 0.5, coverage: { status: "covered" } },
    { id: "b", distanceMi: 2, coverage: { status: "unknown" } },
    { id: "c", distanceMi: null, coverage: { status: "covered" } },
    { id: "d", distanceMi: 8 },
  ];

  it("keeps doctors within the distance and counts those with no location", () => {
    const { shown, hiddenNoLocation } = applyResultFilters(doctors, { within: 3, onlyCovered: false });
    expect(shown.map((d) => d.id)).toEqual(["a", "b"]);
    expect(hiddenNoLocation).toBe(1);
  });

  it("keeps everyone when no distance is set", () => {
    const { shown, hiddenNoLocation } = applyResultFilters(doctors, { within: null, onlyCovered: false });
    expect(shown).toHaveLength(4);
    expect(hiddenNoLocation).toBe(0);
  });

  it("keeps only confirmed doctors when asked", () => {
    const { shown } = applyResultFilters(doctors, { within: null, onlyCovered: true });
    expect(shown.map((d) => d.id)).toEqual(["a", "c"]);
  });
});
