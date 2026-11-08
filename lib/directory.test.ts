import { afterEach, describe, expect, it, vi } from "vitest";
import { searchCitySpecialty } from "./npi";
import { specialtyByLabel, specialtyBySlug, SPECIALTY_LIST } from "./specialties";
import { CITIES, cityBySlug, cityForAddress, cityPath } from "./cities";
import sitemap from "../app/sitemap";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function raw(npi: string, opts: { city?: string; purpose?: string; desc?: string } = {}) {
  return {
    number: npi, enumeration_type: "NPI-1",
    basic: { first_name: "PAT", last_name: "LEE", credential: "MD", status: "A" },
    addresses: [{ address_purpose: opts.purpose ?? "LOCATION", address_1: "1 MAIN ST", city: opts.city ?? "CHICAGO", state: "IL", postal_code: "60601" }],
    taxonomies: [{ desc: opts.desc ?? "Internal Medicine, Cardiovascular Disease", primary: true }],
  };
}

describe("specialties", () => {
  it("gives every specialty a unique plain-language name", () => {
    const plain = SPECIALTY_LIST.map(s => s.plain);
    expect(plain.every(p => typeof p === "string" && p.trim().length > 0)).toBe(true);
    expect(new Set(plain).size).toBe(plain.length);
    expect(specialtyBySlug("cardiology")?.plain).toBe("Heart doctor (cardiologist)");
  });

  it("maps plain labels to the registry's terms and checks the primary specialty", () => {
    const cardiology = specialtyByLabel("Cardiology")!;
    expect(cardiology.query).toBe("Cardiovascular Disease");
    expect(cardiology.primary.test("Internal Medicine, Cardiovascular Disease")).toBe(true);
    expect(cardiology.primary.test("Pharmacist, Cardiology")).toBe(false);
    expect(specialtyBySlug("pediatrics")!.primary.test("Nurse Practitioner, Pediatrics")).toBe(false);
  });
});

describe("cities", () => {
  it("builds stable directory paths and matches registry addresses", () => {
    const city = cityBySlug("ny", "new-york")!;
    expect(cityPath(city, "dentist")).toBe("/find/ny/new-york/dentist");
    expect(cityForAddress("New York", "ny")).toBe(city);
    expect(cityForAddress("New York", "NJ")).toBeUndefined();
  });
});

describe("searchCitySpecialty", () => {
  it("keeps only in-city practice addresses with a matching primary specialty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [
        raw("1000000001"),
        raw("1000000002", { city: "MAYWOOD" }),
        raw("1000000003", { purpose: "MAILING" }),
        raw("1000000004", { desc: "Pharmacist, Cardiology" }),
      ] }),
    })));
    const city = cityBySlug("il", "chicago")!;
    const { doctors, complete } = await searchCitySpecialty(city, specialtyBySlug("cardiology")!);
    expect(doctors.map(d => d.npi)).toEqual(["1000000001"]);
    expect(complete).toBe(true);
  });
});

describe("sitemap", () => {
  it("lists every city and city + specialty page when the site URL is set", () => {
    vi.stubEnv("SITE_URL", "https://example.com");
    const urls = sitemap().map(entry => entry.url);
    expect(urls).toContain("https://example.com/find/il/chicago/cardiology");
    expect(urls.length).toBe(10 + CITIES.length + CITIES.length * SPECIALTY_LIST.length);
  });
});
