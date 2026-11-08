import { describe, it, expect } from "vitest";
import { unsupportedCoverage, coverageMarkerColor } from "./coverage";

describe("unsupportedCoverage", () => {
  it("never claims a positive or negative result for an unverified insurer", () => {
    const display = unsupportedCoverage("Aetna");
    expect(display.status).toBe("unsupported");
    expect(display.label).toBe(
      "This insurance plan is not currently verified by this website."
    );
    expect(display.label.toLowerCase()).not.toMatch(/covered|accepts|in.network/);
  });
});

describe("coverageMarkerColor", () => {
  it("reserves green for a real covered result only", () => {
    expect(coverageMarkerColor("covered")).toBe("var(--ok-ink)");
    for (const status of ["not_covered", "unknown", "unavailable", "unsupported", undefined] as const) {
      expect(coverageMarkerColor(status)).not.toBe("var(--ok-ink)");
    }
  });

  it("uses the design tokens, not raw colors", () => {
    expect(coverageMarkerColor("not_covered")).toBe("var(--danger)");
    expect(coverageMarkerColor(undefined)).toBe("var(--primary)");
  });
});
