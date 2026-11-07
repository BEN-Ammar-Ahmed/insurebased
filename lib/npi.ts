export type Doctor = {
  npi: string;
  name: string;
  specialty: string;
  address1: string;
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

  return {
    npi: String(raw.number),
    name: credential ? `${baseName}, ${credential}` : baseName,
    specialty: taxonomy.desc || "Provider",
    address1: titleCase(addr.address_1 ?? ""),
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
    practiceLocations: [...addresses.filter(a => a.address_purpose === "LOCATION"), ...(raw.practiceLocations ?? [])].map(a => ({ address1: titleCase(a.address_1 ?? ""), city: titleCase(a.city ?? ""), state: a.state ?? "", zip: String(a.postal_code ?? "").slice(0, 5), phone: a.telephone_number ?? null })),
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
    cache: "no-store",
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

  const query: Record<string, string> = {};
  if (params.zip) query.postal_code = params.zip;
  if (params.specialty) query.taxonomy_description = params.specialty;
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
    .filter((d) => !params.zip || d.zip === params.zip);
  return { doctors, hasMore: results.length === NPI_PAGE_SIZE };
}

export async function fetchNpiByNumber(npi: string): Promise<Doctor | null> {
  const results = await callNpi({ number: npi });
  return results.length ? normalizeNpiResult(results[0]) : null;
}
