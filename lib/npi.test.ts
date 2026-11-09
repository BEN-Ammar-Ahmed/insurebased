import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeNpiResult, searchNpi, splitStreetLine } from "./npi";
import sample from "./fixtures/npi-sample.json";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeNpiResult", () => {
  it("normalizes a real NPI-1 record", () => {
    const doc = normalizeNpiResult(sample);
    expect(doc).not.toBeNull();
    expect(doc!.npi).toBe("1942579198");
    expect(doc!.name).toBe("David Aarthun, RPh");
    expect(doc!.specialty).toBe("Pharmacist");
    expect(doc!.address1).toBe("1601 N Wells St");
    expect(doc!.city).toBe("Chicago");
    expect(doc!.state).toBe("IL");
    expect(doc!.zip).toBe("60614");
    expect(doc!.phone).toBe("312-649-1136");
    expect(doc).not.toHaveProperty("plans");
  });

  it("returns null for organization records", () => {
    expect(normalizeNpiResult({ ...sample, enumeration_type: "NPI-2" })).toBeNull();
    expect(
      normalizeNpiResult({ ...sample, basic: { last_name: "ONLY" } })
    ).toBeNull();
  });

  it("returns null for inactive NPI records", () => {
    expect(
      normalizeNpiResult({
        ...sample,
        basic: { ...sample.basic, status: "I" },
      })
    ).toBeNull();
  });

  it("falls back to mailing address when no location address exists", () => {
    const doc = normalizeNpiResult({
      ...sample,
      addresses: [sample.addresses[0]],
    });
    expect(doc).not.toBeNull();
    expect(doc!.city).toBe("Chicago");
  });
});

describe("searchNpi", () => {
  it("filters postal-code searches to the normalized provider location ZIP", async () => {
    const outsideZip = {
      ...sample,
      number: 1578976791,
      addresses: sample.addresses.map((address) => ({
        ...address,
        city: "GARY",
        state: "IN",
        postal_code: "464081234",
      })),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ results: [outsideZip, sample] }),
      }))
    );

    const result = await searchNpi({ zip: "60614", specialty: "Pharmacist" });

    expect(result.doctors).toHaveLength(1);
    expect(result.doctors[0].zip).toBe("60614");
    expect(result.doctors[0].name).toBe("David Aarthun, RPh");
  });

  it("uses physician-focused taxonomy searches for broad ZIP searches", async () => {
    const familyDoctor = {
      ...sample,
      number: 1891743175,
      basic: { ...sample.basic, first_name: "LINA", last_name: "ABUJAMRA", credential: "MD" },
      taxonomies: [{ primary: true, desc: "Family Medicine" }],
    };
    const pharmacist = {
      ...sample,
      number: 1942579198,
      taxonomies: [{ primary: true, desc: "Pharmacist" }],
    };
    const familyNurse = {
      ...sample,
      number: 1555555555,
      basic: {
        ...sample.basic,
        first_name: "KARI",
        last_name: "AUGHENBAUGH",
        credential: "ARNP-BC",
      },
      taxonomies: [{ primary: true, desc: "Family Medicine" }],
    };
    const calls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        const taxonomy = new URL(url).searchParams.get("taxonomy_description");
        return {
          ok: true,
          json: async () => ({
            results:
              taxonomy === "Family Medicine"
                ? [familyDoctor, pharmacist, familyNurse]
                : taxonomy === "Internal Medicine"
                  ? [familyDoctor]
                  : [],
          }),
        };
      })
    );

    const result = await searchNpi({ zip: "60614" });

    expect(calls.length).toBeGreaterThan(1);
    expect(calls.every((url) => new URL(url).searchParams.has("taxonomy_description"))).toBe(
      true
    );
    expect(calls.some((url) => url.includes("Family+Medicine"))).toBe(true);
    expect(result.doctors).toHaveLength(1);
    expect(result.doctors[0].name).toBe("Lina Abujamra, MD");
    expect(result.doctors[0].specialty).toBe("Family Medicine");
  });
});
it("paginates the combined physician specialties without dropping other specialties", async () => {
  const { searchNpi } = await import("./npi");
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const q = new URL(input).searchParams;
    const taxonomy = q.get("taxonomy_description");
    const count = taxonomy === "Family Medicine" ? 35 : taxonomy === "Internal Medicine" ? 30 : 0;
    return { ok: true, json: async () => ({ results: Array.from({ length: count }, (_, i) => ({
      number: String((taxonomy === "Family Medicine" ? 1000000000 : 2000000000) + i),
      enumeration_type: "NPI-1", basic: { first_name: "Fixture", last_name: "Provider", credential: "MD", status: "A" },
      addresses: [{ address_purpose: "LOCATION", address_1: "100 Test Street", city: "Chicago", state: "IL", postal_code: "60615" }],
      taxonomies: [{ primary: true, desc: taxonomy }],
    })) }) };
  }));
  const first = await searchNpi({ zip: "60615" });
  const second = await searchNpi({ zip: "60615", skip: 50 });
  expect(first.doctors).toHaveLength(50);
  expect(first.hasMore).toBe(true);
  expect(second.doctors).toHaveLength(15);
  expect(second.hasMore).toBe(false);
  expect(new Set([...first.doctors, ...second.doctors].map(d => d.npi)).size).toBe(65);
});

describe("splitStreetLine", () => {
  it("keeps a normal street line", () => {
    expect(splitStreetLine("10501 FGCU BLVD S", "")).toEqual({ street: "10501 FGCU BLVD S" });
  });
  it("uses the second line when the first is a building name", () => {
    expect(splitStreetLine("FLORIDA GULF COAST UNIVERSITY", "10501 FGCU BLVD. SOUTH")).toEqual({ street: "10501 FGCU BLVD. SOUTH", placeName: "FLORIDA GULF COAST UNIVERSITY" });
  });
  it("splits a name and street run together on one line", () => {
    expect(splitStreetLine("FLORIDA GULF COAST UNIVERSITY 10483 FGCU BLVD SOUTH", "")).toEqual({ street: "10483 FGCU BLVD SOUTH", placeName: "FLORIDA GULF COAST UNIVERSITY" });
  });
  it("does not treat a suite number as a street", () => {
    expect(splitStreetLine("MEDICAL PLAZA SUITE 200 WEST", "")).toEqual({ street: "MEDICAL PLAZA SUITE 200 WEST" });
  });
});
