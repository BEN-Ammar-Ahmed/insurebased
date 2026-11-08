import { describe, expect, it, vi } from "vitest";
import { LOCATION_MESSAGES, parseLocationInput, resolveLocation, roundCoord } from "./locationInput";

describe("parseLocationInput", () => {
  it("accepts a 5-digit ZIP, trimming spaces", () => {
    expect(parseLocationInput(" 60614 ")).toEqual({ kind: "zip", zip: "60614" });
  });

  it("keeps the first five digits of a ZIP+4", () => {
    expect(parseLocationInput("60614-1234")).toEqual({ kind: "zip", zip: "60614" });
  });

  it("reports empty input", () => {
    expect(parseLocationInput("   ")).toEqual({ kind: "empty" });
  });

  it("rejects a short number", () => {
    expect(parseLocationInput("6061")).toEqual({ kind: "invalid", message: LOCATION_MESSAGES.invalid });
  });

  it("rejects a city with no street number", () => {
    expect(parseLocationInput("Chicago IL").kind).toBe("invalid");
  });

  it("accepts a street address", () => {
    expect(parseLocationInput("2400 N Lakeview Ave, Chicago, IL")).toEqual({
      kind: "address",
      address: "2400 N Lakeview Ave, Chicago, IL",
    });
  });

  it("rejects an overly long address", () => {
    expect(parseLocationInput("1 " + "a".repeat(199)).kind).toBe("invalid");
  });
});

describe("roundCoord", () => {
  it("rounds to three decimals", () => {
    expect(roundCoord(41.92345)).toBe("41.923");
    expect(roundCoord(-87.6389)).toBe("-87.639");
  });
});

describe("resolveLocation", () => {
  it("turns a geocoded address into rounded coordinates", async () => {
    const result = await resolveLocation("2400 N Lakeview Ave, Chicago, IL", async () => ({ lat: 41.92345, lng: -87.6389 }));
    expect(result).toEqual({ kind: "place", place: { lat: "41.923", lng: "-87.639" } });
  });

  it("never guesses when the address isn't found", async () => {
    const result = await resolveLocation("2400 N Lakeview Ave, Chicago, IL", async () => null);
    expect(result).toEqual({ kind: "error", message: "We couldn't find that address. Try a ZIP code." });
  });

  it("does not geocode a ZIP code", async () => {
    const geocode = vi.fn();
    expect(await resolveLocation("60614", geocode)).toEqual({ kind: "place", place: { zip: "60614" } });
    expect(geocode).not.toHaveBeenCalled();
  });

  it("returns the empty message for blank input", async () => {
    expect(await resolveLocation("", async () => null)).toEqual({ kind: "error", message: LOCATION_MESSAGES.empty });
  });
});
