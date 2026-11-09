import { specialtyByLabel, type Specialty } from "./specialties";

export type Doctor = {
  npi: string;
  name: string;
  specialty: string;
  address1: string;
  // A building or clinic name filed in place of the street line, if any.
  placeName?: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  distanceMi: number | null;
  locationApproximate: boolean;
  locationPrecision?: "address" | "zip" | "unknown";
  locationSource?: "nppes" | "census" | "stored" | "zip";
  sourceUpdatedAt?: string;
  addressKind?: "practice" | "mailing";
  practiceLocations?: { address1: string; city: string; state: string; zip: string; phone: string | null }[];
};

const NPI_BASE = "https://npiregistry.cms.hhs.gov/api/";
export const DEFAULT_DOCTOR_SPECIALTIES = [
  "Family Medicine",
  "Internal Medicine",
  "Pediatrics",
  "Obstetrics & Gynecology",
  "Psychiatry",
  "Emergency Medicine",
  "Dermatology",
  "Cardiology",
  "Ophthalmology",
  "Orthopaedic Surgery",
];

const DEFAULT_DOCTOR_MATCHES = [
  "family medicine",
  "internal medicine",
  "pediatrics",
  "obstetrics",
  "gynecology",
  "psychiatry",
  "emergency medicine",
  "dermatology",
  "cardiology",
  "cardiovascular disease",
  "ophthalmology",
  "orthopaedic surgery",
  "orthopedic surgery",
];

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

const STREET_START = /^\d+[a-z]?\s+\S/i;
const NOT_A_STREET = /\b(suite|ste|unit|room|rm|bldg|building|floor|fl|apt|#)\s*$/i;

// Some records put a clinic or building name on the first address line and
// the street on the second ("Florida Gulf Coast University" / "10501 Fgcu
// Blvd S"), or run them together on one line. Geocoding needs the street.
export function splitStreetLine(line1: string, line2: string): { street: string; placeName?: string } {
  const one = line1.trim(), two = line2.trim();
  if (!one || STREET_START.test(one)) return { street: one };
  if (STREET_START.test(two)) return { street: two, placeName: one };
  const inline = /\s(\d{2,6}[a-z]?\s+[a-z]\S*.*)$/i.exec(one);
  if (inline && !NOT_A_STREET.test(one.slice(0, inline.index))) {
    return { street: inline[1].trim(), placeName: one.slice(0, inline.index).replace(/[\s,-]+$/, "") };
  }
  return { street: one };
}

export function normalizeNpiResult(raw: any): Doctor | null {
  if (!raw || raw.enumeration_type !== "NPI-1") return null;
  const basic = raw.basic;
  if (!basic?.first_name || !basic?.last_name) return null;
  if (basic.status && basic.status !== "A") return null;

  const addresses: any[] = raw.addresses ?? [];
  const addr =
    addresses.find((a) => a.address_purpose === "LOCATION") ?? addresses[0];
  if (!addr) return null;

  const taxonomies: any[] = raw.taxonomies ?? [];
  const taxonomy =
    taxonomies.find((t) => t.primary) ?? taxonomies[0] ?? { desc: "Provider" };

  const rawCredential = String(basic.credential ?? "");
  // Some records are typed all lowercase ("m.d."); keep mixed case like "RPh" as filed.
  const credential = (rawCredential === rawCredential.toLowerCase() ? rawCredential.toUpperCase() : rawCredential)
    .replace(/\./g, "")
    .replace(/^-+$/, "")
    .trim();
  const baseName = `${titleCase(basic.first_name)} ${titleCase(basic.last_name)}`;
  const line = splitStreetLine(addr.address_1 ?? "", addr.address_2 ?? "");

  return {
    npi: String(raw.number),
    name: credential ? `${baseName}, ${credential}` : baseName,
    specialty: taxonomy.desc || "Provider",
    address1: titleCase(line.street),
    ...(line.placeName ? { placeName: titleCase(line.placeName) } : {}),
    city: titleCase(addr.city ?? ""),
    state: addr.state ?? "",
    zip: String(addr.postal_code ?? "").slice(0, 5),
    phone: addr.telephone_number ?? null,
    lat: null,
    lng: null,
    distanceMi: null,
    locationApproximate: true,
    locationPrecision: "unknown",
    locationSource: "nppes",
    addressKind: addr.address_purpose === "LOCATION" ? "practice" : "mailing",
    sourceUpdatedAt: typeof basic.last_updated === "string" ? basic.last_updated : undefined,
    practiceLocations: [...addresses.filter(a => a.address_purpose === "LOCATION"), ...(raw.practiceLocations ?? [])].map(a => ({ address1: titleCase(splitStreetLine(a.address_1 ?? "", a.address_2 ?? "").street), city: titleCase(a.city ?? ""), state: a.state ?? "", zip: String(a.postal_code ?? "").slice(0, 5), phone: a.telephone_number ?? null })),
  };
}

async function callNpi(params: Record<string, string>): Promise<any[]> {
  const qs = new URLSearchParams({
    version: "2.1",
    enumeration_type: "NPI-1",
    limit: "50",
    ...params,
  });
  const res = await fetch(`${NPI_BASE}?${qs}`, {
    signal: AbortSignal.timeout(8000),
    // Cached for a day (only 200 responses are stored). "no-store" would
    // crash the daily-cached /find pages in production.
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`NPI registry responded ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

export const NPI_PAGE_SIZE = 50;

function isDefaultDoctorSpecialty(specialty: string): boolean {
  const normalized = specialty.toLowerCase();
  return DEFAULT_DOCTOR_MATCHES.some((match) => normalized.includes(match));
}

function hasPhysicianCredential(name: string): boolean {
  return /,\s*(MD|DO)\b/i.test(name);
}

type DefaultPage = { doctors: Doctor[]; active: string[]; sourceSkip: number; expires: number; pending?: Promise<void> };
const defaultSearchCache = new Map<string, DefaultPage>();

async function searchDefaultDoctors(params: { zip: string; state?: string; skip?: number }): Promise<{ doctors: Doctor[]; hasMore: boolean }> {
  const key = params.zip + ":" + (params.state ?? "");
  let page = defaultSearchCache.get(key);
  if (!page || page.expires < Date.now()) {
    if (defaultSearchCache.size >= 100) defaultSearchCache.delete(defaultSearchCache.keys().next().value!);
    page = { doctors: [], active: [...DEFAULT_DOCTOR_SPECIALTIES], sourceSkip: 0, expires: Date.now() + 300000 };
    defaultSearchCache.set(key, page);
  }
  const skip = params.skip ?? 0;
  while (page.doctors.length < skip + NPI_PAGE_SIZE && page.active.length && page.sourceSkip <= 1000) {
    if (!page.pending) {
      const current = page;
      current.pending = (async () => {
        const batches = await Promise.all(current.active.map(async taxonomy => ({ taxonomy, records: await callNpi({ postal_code: params.zip, taxonomy_description: taxonomy, skip: String(current.sourceSkip), ...(params.state ? { state: params.state } : {}) }) })));
        const byNpi = new Map(current.doctors.map(d => [d.npi, d]));
        for (const { records } of batches) for (const raw of records) {
          const doctor = normalizeNpiResult(raw);
          if (doctor && doctor.zip === params.zip && isDefaultDoctorSpecialty(doctor.specialty) && hasPhysicianCredential(doctor.name)) byNpi.set(doctor.npi, doctor);
        }
        current.doctors = [...byNpi.values()];
        current.active = batches.filter(batch => batch.records.length === NPI_PAGE_SIZE).map(batch => batch.taxonomy);
        current.sourceSkip += NPI_PAGE_SIZE;
      })().finally(() => { current.pending = undefined; });
    }
    await page.pending;
  }
  return { doctors: page.doctors.slice(skip, skip + NPI_PAGE_SIZE), hasMore: page.doctors.length > skip + NPI_PAGE_SIZE || (page.active.length > 0 && page.sourceSkip <= 1000) };
}

const nameSearchCache = new Map<string, { doctors: Doctor[]; expires: number }>();
const NAME_PAGES = [0, 200, 400, 600, 800, 1000];

// The registry sorts name matches alphabetically and also matches former
// names, so for a common name like "Smith" the first page is all people who
// used to be called Smith. Pull every page the registry allows in parallel,
// then keep people whose current name matches.
async function searchByName(params: { lastName: string; firstName?: string; state?: string; skip: number }): Promise<{ doctors: Doctor[]; hasMore: boolean }> {
  const key = [params.lastName, params.firstName ?? "", params.state ?? ""].join("|").toLowerCase();
  let entry = nameSearchCache.get(key);
  if (!entry || entry.expires < Date.now()) {
    const base: Record<string, string> = { last_name: params.lastName, limit: "200" };
    if (params.firstName) base.first_name = params.firstName;
    if (params.state) base.state = params.state;
    const first = await callNpi({ ...base, skip: "0" });
    const rest = first.length === 200
      ? await Promise.all(NAME_PAGES.slice(1).map(skip => callNpi({ ...base, skip: String(skip) }).catch(() => [])))
      : [];
    const raw = [first, ...rest].flat();
    const prefix = (value?: string) => (value ?? "").replace(/\*$/, "").toLowerCase();
    const lastPrefix = prefix(params.lastName);
    const firstPrefix = prefix(params.firstName);
    const current = raw.filter(r =>
      String(r?.basic?.last_name ?? "").toLowerCase().startsWith(lastPrefix) &&
      (!firstPrefix || String(r?.basic?.first_name ?? "").toLowerCase().startsWith(firstPrefix)));
    const byNpi = new Map<string, Doctor>();
    for (const r of current.length ? current : raw) {
      const doctor = normalizeNpiResult(r);
      if (doctor) byNpi.set(doctor.npi, doctor);
    }
    entry = { doctors: [...byNpi.values()], expires: Date.now() + 300000 };
    if (nameSearchCache.size >= 200) nameSearchCache.delete(nameSearchCache.keys().next().value!);
    nameSearchCache.set(key, entry);
  }
  return { doctors: entry.doctors.slice(params.skip, params.skip + NPI_PAGE_SIZE), hasMore: entry.doctors.length > params.skip + NPI_PAGE_SIZE };
}

export async function searchNpi(params: {
  zip?: string;
  specialty?: string;
  firstName?: string;
  lastName?: string;
  state?: string;
  skip?: number;
}): Promise<{ doctors: Doctor[]; hasMore: boolean }> {
  if (params.zip && !params.specialty && !params.firstName && !params.lastName) {
    return searchDefaultDoctors({
      zip: params.zip,
      state: params.state,
      skip: params.skip,
    });
  }

  if (params.lastName && !params.zip && !params.specialty) {
    return searchByName({ lastName: params.lastName, firstName: params.firstName, state: params.state, skip: params.skip ?? 0 });
  }

  const specialty = params.specialty ? specialtyByLabel(params.specialty) : undefined;
  const query: Record<string, string> = {};
  if (params.zip) query.postal_code = params.zip;
  if (params.specialty) query.taxonomy_description = specialty?.query ?? params.specialty;
  if (params.firstName) query.first_name = params.firstName;
  if (params.lastName) query.last_name = params.lastName;
  if (params.state) query.state = params.state;
  if (params.skip) query.skip = String(params.skip);

  const results = await callNpi(query);
  // The registry also matches former/other names, so "smith" can return a
  // provider named Albeedh. Only keep records whose current name matches.
  const prefix = (value?: string) => (value ?? "").replace(/\*$/, "").toLowerCase();
  const lastPrefix = prefix(params.lastName);
  const firstPrefix = prefix(params.firstName);
  const doctors = results
    .filter((raw) =>
      (!lastPrefix || String(raw?.basic?.last_name ?? "").toLowerCase().startsWith(lastPrefix)) &&
      (!firstPrefix || String(raw?.basic?.first_name ?? "").toLowerCase().startsWith(firstPrefix))
    )
    .map(normalizeNpiResult)
    .filter((d): d is Doctor => d !== null)
    .filter((d) => !params.zip || d.zip === params.zip)
    .filter((d) => !specialty || specialty.primary.test(d.specialty));
  return { doctors, hasMore: results.length === NPI_PAGE_SIZE };
}

type CityResult = { doctors: Doctor[]; complete: boolean };
const cityCache = new Map<string, CityResult & { expires: number }>();
const CITY_PAGES = [0, 200, 400];

// Providers whose *practice* address is in a city and whose primary
// specialty matches. The registry's city filter also matches mailing
// addresses and secondary specialties, so both are re-checked here.
// `complete` is false when the registry had more rows than we fetched.
export async function searchCitySpecialty(city: { registryCity: string; state: string }, specialty: Specialty): Promise<CityResult> {
  const key = [city.registryCity, city.state, specialty.slug].join("|");
  const hit = cityCache.get(key);
  if (hit && hit.expires > Date.now()) return { doctors: hit.doctors, complete: hit.complete };
  const base = { city: city.registryCity, state: city.state, taxonomy_description: specialty.query, limit: "200" };
  const first = await callNpi({ ...base, skip: "0" });
  const rest = first.length === 200
    ? await Promise.all(CITY_PAGES.slice(1).map(skip => callNpi({ ...base, skip: String(skip) }).catch(() => [])))
    : [];
  const byNpi = new Map<string, Doctor>();
  for (const raw of [first, ...rest].flat()) {
    const doctor = normalizeNpiResult(raw);
    if (!doctor || doctor.addressKind !== "practice") continue;
    if (doctor.city.toUpperCase() !== city.registryCity || doctor.state !== city.state) continue;
    if (!specialty.primary.test(doctor.specialty)) continue;
    byNpi.set(doctor.npi, doctor);
  }
  const doctors = [...byNpi.values()];
  const lastPage = rest.length ? rest[rest.length - 1] : first;
  const complete = lastPage.length < 200;
  if (cityCache.size >= 500) cityCache.delete(cityCache.keys().next().value!);
  cityCache.set(key, { doctors, complete, expires: Date.now() + 6 * 3600000 });
  return { doctors, complete };
}

export async function fetchNpiByNumber(npi: string): Promise<Doctor | null> {
  const results = await callNpi({ number: npi });
  return results.length ? normalizeNpiResult(results[0]) : null;
}
