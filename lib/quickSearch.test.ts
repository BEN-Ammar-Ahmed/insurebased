import { describe, expect, it } from "vitest";
import { parseQuickSearch } from "./quickSearch";

describe("parseQuickSearch", () => {
  it("keeps a plain ZIP or address as the location", () => {
    expect(parseQuickSearch(" 33965 ")).toEqual({ location: "33965", category: null });
    expect(parseQuickSearch("10501 FGCU Blvd S, Fort Myers, FL")).toEqual({ location: "10501 FGCU Blvd S, Fort Myers, FL", category: null });
  });

  it("pulls Medicare out of the text", () => {
    expect(parseQuickSearch("33965 medicare")).toEqual({ location: "33965", category: "medicare" });
    expect(parseQuickSearch("Original Medicare, 60614")).toEqual({ location: "60614", category: "medicare" });
  });

  it("treats Medicare Advantage as a private insurer, not Original Medicare", () => {
    expect(parseQuickSearch("medicare advantage 33965")).toEqual({ location: "33965", category: "other", insurerName: "Medicare Advantage" });
  });

  it("recognizes ACA words and named insurers", () => {
    expect(parseQuickSearch("obamacare 33965").category).toBe("marketplace");
    expect(parseQuickSearch("33965 aetna")).toEqual({ location: "33965", category: "other", insurerName: "Aetna" });
  });

  it("returns an empty location when only insurance was typed", () => {
    expect(parseQuickSearch("medicare")).toEqual({ location: "", category: "medicare" });
  });
});
