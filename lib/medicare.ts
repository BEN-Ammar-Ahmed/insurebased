import { COVERAGE_LABELS, type CoverageDisplay } from "./coverage";

// Real data: CMS's public "Doctors and Clinicians" dataset (Care Compare),
// which lists every clinician currently enrolled in Original Medicare and
// whether they accept the Medicare-approved amount as payment in full.
// Confirmed live against the API on 2026-07-25 — dataset id mj5m-pzi6,
// field `npi`, field `ind_assgn` with real values "Y" and "M" (256k+ "M"
// records exist live, confirming it's a genuine, common value, not a rare
// edge case). Any unrecognized value falls back to "no record" rather than
// being treated as a positive match.
const CMS_DATASET_ID = "mj5m-pzi6";
const CMS_QUERY_BASE = `https://data.cms.gov/provider-data/api/1/datastore/query/${CMS_DATASET_ID}/0`;
// CMS scans the whole dataset per request (~5-6s) no matter how many NPIs are
// asked for, so one request per page of results is far faster than many.
const MEDICARE_BATCH_SIZE = 50;
const MEDICARE_TIMEOUT_MS = 15000;

export type MedicareResult = (
  | { status: "assigned" }
  | { status: "maybe" }
  | { status: "no_record" }
  | { status: "unavailable" }) & { sourceUpdatedAt?: string; checkedAt?: string };

const cache = new Map<string, { result: MedicareResult; expires: number }>();

async function fetchMedicareChunk(npis: string[]): Promise<Map<string, MedicareResult>> {
  const results = new Map<string, MedicareResult>();
  try {
    const qs = new URLSearchParams({
      "conditions[0][property]": "npi",
      "conditions[0][operator]": "IN",
      "properties[0]": "npi",
      "properties[1]": "ind_assgn",
      limit: String(npis.length * 4),
      // Skipping the row count and schema roughly halves CMS response time.
      count: "false",
      schema: "false",
    });
    npis.forEach((npi, i) => qs.append(`conditions[0][value][${i}]`, npi));

    const res = await fetch(`${CMS_QUERY_BASE}?${qs}`, {
      signal: AbortSignal.timeout(MEDICARE_TIMEOUT_MS),
      // Cached for a day; Next only stores 200 responses, so failures retry.
      // "no-store" would crash the daily-cached /find pages in production.
      next: { revalidate: 86400 },
      headers: { "User-Agent": "InsureBased provider lookup (public data)", Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`CMS Doctors & Clinicians API responded ${res.status}`);
    const data = await res.json();
    const rows: { npi: string; ind_assgn: string }[] = data.results ?? [];

    const bestValue = new Map<string, string>();
    for (const row of rows) {
      const current = bestValue.get(row.npi);
      if (row.ind_assgn === "Y") bestValue.set(row.npi, "Y");
      else if (row.ind_assgn === "M" && current !== "Y") bestValue.set(row.npi, "M");
      else if (!current) bestValue.set(row.npi, row.ind_assgn ?? "");
    }

    const checkedAt = new Date().toISOString();
    for (const npi of npis) {
      const value = bestValue.get(npi);
      const result: MedicareResult =
        value === "Y"
          ? { status: "assigned" }
          : value === "M"
            ? { status: "maybe" }
            : { status: "no_record" };
      result.checkedAt = checkedAt;
      if (cache.size >= 5000) cache.delete(cache.keys().next().value!);
      cache.set(npi, { result, expires: Date.now() + 86400000 });
      results.set(npi, result);
    }
  } catch {
    console.error("Medicare assignment service unavailable");
    // Don't cache failures — a later retry should get a fresh chance.
    for (const npi of npis) results.set(npi, { status: "unavailable" });
  }
  return results;
}

export async function checkMedicareAssignment(
  npis: string[]
): Promise<Map<string, MedicareResult>> {
  const unique = [...new Set(npis)];
  const results = new Map<string, MedicareResult>();
  const toFetch: string[] = [];
  for (const npi of unique) {
    const cached = cache.get(npi);
    if (cached && cached.expires > Date.now()) results.set(npi, cached.result);
    else toFetch.push(npi);
  }
  if (toFetch.length === 0) return results;

  const chunks: string[][] = [];
  for (let i = 0; i < toFetch.length; i += MEDICARE_BATCH_SIZE) chunks.push(toFetch.slice(i, i + MEDICARE_BATCH_SIZE));
  const batches = await Promise.all(chunks.map(fetchMedicareChunk));
  for (const batch of batches) for (const [npi, result] of batch) results.set(npi, result);
  return results;
}

const MEDICARE_ADVANTAGE_NOTE =
  "This result applies to Original Medicare assignment. It does not confirm participation in a Medicare Advantage plan.";
const SOURCE = "Official Medicare data";

export function medicareCoverageDisplay(result: MedicareResult): CoverageDisplay {
  const checkedAt = result.checkedAt ?? new Date().toISOString();
  switch (result.status) {
    case "assigned":
      return {
        status: "covered",
        label: COVERAGE_LABELS.medicareAssigned,
        source: SOURCE,
        checkedAt,
        sourceUpdatedAt: result.sourceUpdatedAt,
        note: MEDICARE_ADVANTAGE_NOTE,
      };
    case "maybe":
      return {
        status: "unknown",
        label: COVERAGE_LABELS.medicareMaybe,
        source: SOURCE,
        checkedAt,
        note: MEDICARE_ADVANTAGE_NOTE,
      };
    case "no_record":
      return {
        status: "unknown",
        label: COVERAGE_LABELS.medicareUnknown,
        source: SOURCE,
        checkedAt,
        note: MEDICARE_ADVANTAGE_NOTE,
      };
    case "unavailable":
      return {
        status: "unavailable",
        label: COVERAGE_LABELS.unavailable,
        source: SOURCE,
        checkedAt,
      };
  }
}
