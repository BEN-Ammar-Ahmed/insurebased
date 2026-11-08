import { describe, expect, it, vi } from "vitest";
import { decodeMedicareList, encodeMedicareList, lookupAssignment } from "./medicareList";

describe("Medicare assignment list", () => {
  const buf = encodeMedicareList("2026-10-15", [1558351643, 1003000126, 1999999999], [1518087030]);

  it("round-trips the release date and both NPI sets", () => {
    const list = decodeMedicareList(buf);
    expect(list.sourceDate).toBe("2026-10-15");
    expect([...list.yes]).toEqual([1003000126, 1558351643, 1999999999]);
    expect([...list.maybe]).toEqual([1518087030]);
  });

  it("looks up Y, M, and missing NPIs without guessing", () => {
    const list = decodeMedicareList(buf);
    expect(lookupAssignment(list, "1558351643")).toBe("Y");
    expect(lookupAssignment(list, "1999999999")).toBe("Y");
    expect(lookupAssignment(list, "1518087030")).toBe("M");
    expect(lookupAssignment(list, "1234567890")).toBeNull();
    expect(lookupAssignment(list, "abc")).toBeNull();
  });

  it("rejects truncated or foreign files", () => {
    expect(() => decodeMedicareList(buf.subarray(0, buf.length - 4))).toThrow();
    expect(() => decodeMedicareList(Buffer.from("not a list at all, definitely not"))).toThrow();
  });
});

describe("checkMedicareAssignment with the bundled list", () => {
  it("answers from the list with its CMS release date and makes no network call", async () => {
    vi.resetModules();
    vi.doMock("./medicareList", async (orig) => {
      const real = await orig<typeof import("./medicareList")>();
      const list = real.decodeMedicareList(real.encodeMedicareList("2026-10-15", [1558351643], [1518087030]));
      return { ...real, bundledMedicareList: () => list };
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { checkMedicareAssignment, medicareCoverageDisplay } = await import("./medicare");
    const results = await checkMedicareAssignment(["1558351643", "1518087030", "1234567890"]);
    expect(results.get("1558351643")).toMatchObject({ status: "assigned", sourceUpdatedAt: "2026-10-15" });
    expect(results.get("1518087030")).toMatchObject({ status: "maybe" });
    expect(results.get("1234567890")).toMatchObject({ status: "no_record" });
    expect(medicareCoverageDisplay(results.get("1234567890")!).label.toLowerCase()).toContain("unable to verify");
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.doUnmock("./medicareList");
  });
});
