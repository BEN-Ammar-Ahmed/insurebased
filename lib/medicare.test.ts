import { describe, it, expect, vi, afterEach } from "vitest";
import { checkMedicareAssignment, medicareCoverageDisplay } from "./medicare";

// These tests cover the live-API fallback, so hide the bundled list.
vi.mock("./medicareList", () => ({ bundledMedicareList: () => null, lookupAssignment: () => null }));

describe("checkMedicareAssignment", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("maps ind_assgn Y to assigned", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ npi: "1111111111", ind_assgn: "Y" }] }),
    }) as unknown as typeof fetch;

    const result = await checkMedicareAssignment(["1111111111"]);
    expect(result.get("1111111111")).toMatchObject({ status: "assigned" });
  });

  it("maps ind_assgn M to maybe, distinct from Y", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ npi: "2222222222", ind_assgn: "M" }] }),
    }) as unknown as typeof fetch;

    const result = await checkMedicareAssignment(["2222222222"]);
    expect(result.get("2222222222")).toMatchObject({ status: "maybe" });

    const assignedLabel = medicareCoverageDisplay({ status: "assigned" }).label;
    const maybeLabel = medicareCoverageDisplay({ status: "maybe" }).label;
    expect(assignedLabel).not.toBe(maybeLabel);
  });

  it("treats a missing NPI as no_record, not a negative result", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    }) as unknown as typeof fetch;

    const result = await checkMedicareAssignment(["3333333333"]);
    expect(result.get("3333333333")).toMatchObject({ status: "no_record" });
    const display = medicareCoverageDisplay(result.get("3333333333")!);
    expect(display.label.toLowerCase()).not.toContain("does not accept");
    expect(display.label.toLowerCase()).toContain("unable to verify");
  });

  it("treats a fetch failure as unavailable, not a fabricated answer", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const result = await checkMedicareAssignment(["4444444444"]);
    expect(result.get("4444444444")).toMatchObject({ status: "unavailable" });
    expect(medicareCoverageDisplay(result.get("4444444444")!).status).toBe("unavailable");
  });

  it("chunks large Medicare checks and does not fail every doctor when one chunk fails", async () => {
    const npis = Array.from({ length: 60 }, (_, i) => `8${String(i).padStart(9, "0")}`);
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ npi: npis[0], ind_assgn: "Y" }] }),
      })
      .mockRejectedValueOnce(new Error("chunk timeout")) as unknown as typeof fetch;

    const result = await checkMedicareAssignment(npis);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.get(npis[0])).toMatchObject({ status: "assigned" });
    expect(result.get(npis[1])).toMatchObject({ status: "no_record" });
    expect(result.get(npis[50])).toMatchObject({ status: "unavailable" });
  });
});

describe("medicareCoverageDisplay", () => {
  it("never labels a result as plain 'Accepts Medicare'", () => {
    for (const status of ["assigned", "maybe", "no_record", "unavailable"] as const) {
      const display = medicareCoverageDisplay({ status });
      expect(display.label.toLowerCase()).not.toBe("accepts medicare");
    }
  });

  it("includes the Medicare Advantage disclaimer whenever a definite result is shown", () => {
    const display = medicareCoverageDisplay({ status: "assigned" });
    expect(display.note).toMatch(/Medicare Advantage/);
  });
});
