import { afterEach, describe, expect, it, vi } from "vitest";
import { searchNpi } from "./npi";
import { addressesToLatLng } from "./geo";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function rawProvider(npi: string, first: string, last: string) {
  return {
    number: npi, enumeration_type: "NPI-1",
    basic: { first_name: first, last_name: last, status: "A" },
    addresses: [{ address_purpose: "LOCATION", address_1: "1 Main St", city: "Chicago", state: "IL", postal_code: "60601" }],
    taxonomies: [{ desc: "Family Medicine", primary: true }],
  };
}

describe("name search", () => {
  it("drops providers who only matched on a former name", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [rawProvider("1000000001", "SAMANTHA", "ALBEEDH"), rawProvider("1000000002", "AARON", "SMITH")] }),
    })));
    const { doctors } = await searchNpi({ lastName: "smith*", state: "IL" });
    expect(doctors.map(d => d.name)).toEqual(["Aaron Smith"]);
  });
});

describe("addressesToLatLng", () => {
  it("reads matched coordinates from one Census batch response and skips non-matches", async () => {
    const body = [
      '"a","1 Main St, Chicago, IL, 60601","Match","Exact","1 MAIN ST, CHICAGO, IL, 60601","-87.62,41.88","1","L"',
      '"b","9 Nowhere Rd, Chicago, IL, 60601","No_Match"',
    ].join("\n");
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => body }));
    vi.stubGlobal("fetch", fetchMock);
    const points = await addressesToLatLng([
      { id: "a", street: "1 Main St", city: "Chicago", state: "IL", zip: "60601" },
      { id: "b", street: "9 Nowhere Rd", city: "Chicago", state: "IL", zip: "60601" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(points.get("a")).toEqual({ lat: 41.88, lng: -87.62 });
    expect(points.has("b")).toBe(false);
  });
});
