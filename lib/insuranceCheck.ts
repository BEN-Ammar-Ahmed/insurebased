import { isValidPlanId, isValidPlanYear } from "./validation";
import { storedMedicare } from "./providerStore";
import type { CoverageDisplay } from "./coverage";
import { COVERAGE_LABELS, unsupportedCoverage } from "./coverage";
import { checkMedicareAssignment, medicareCoverageDisplay } from "./medicare";
import {
  checkMarketplaceCoverage,
  marketplaceCoverageDisplay,
  MarketplaceConfigError,
} from "./marketplace";

export type InsuranceQuery =
  | {
      category: "marketplace";
      planId: string;
      planName: string;
      issuerName: string;
      planYear: number;
    }
  | { category: "medicare" }
  | { category: "other"; insurerName?: string }
  | { category: "none" };

// Runs the right real (or honestly-unverified) check for a batch of NPIs
// and returns one CoverageDisplay per doctor. Shared by the search route
// (many doctors) and the detail route (one doctor) so the two screens can
// never show different logic for the same category.
export async function computeCoverage(
  npis: string[],
  query: InsuranceQuery
): Promise<Map<string, CoverageDisplay>> {
  const out = new Map<string, CoverageDisplay>();
  if (npis.length === 0 || query.category === "none") return out;

  if (query.category === "medicare") {
    let results;
    try { results = await storedMedicare(npis) ?? await checkMedicareAssignment(npis); }
    catch { results = new Map(npis.map(npi => [npi, { status: "unavailable" as const }])); }
    for (const npi of npis) {
      out.set(npi, medicareCoverageDisplay(results.get(npi) ?? { status: "no_record" }));
    }
    return out;
  }

  if (query.category === "marketplace") {
    try {
      const results = await checkMarketplaceCoverage(npis, query.planId, query.planYear);
      for (const npi of npis) {
        out.set(
          npi,
          marketplaceCoverageDisplay(results.get(npi) ?? { status: "unavailable" }, {
            name: query.planName,
            issuerName: query.issuerName,
            year: query.planYear,
          })
        );
      }
    } catch (err) {
      const label =
        err instanceof MarketplaceConfigError
          ? COVERAGE_LABELS.notConfigured
          : COVERAGE_LABELS.unavailable;
      for (const npi of npis) {
        out.set(npi, {
          status: "unavailable",
          label,
          source: "HealthCare.gov Marketplace data",
          checkedAt: new Date().toISOString(),
        });
      }
    }
    return out;
  }

  // "other" — no free verified source exists for these carriers.
  for (const npi of npis) out.set(npi, unsupportedCoverage(query.insurerName));
  return out;
}

// Reads the insurance part of a query string. Shared by every API route so a
// plan can never be validated differently on two screens.
export function parseInsuranceQuery(sp: URLSearchParams): InsuranceQuery | { error: string } {
  const category = sp.get("category") ?? "none";
  if (category === "medicare") return { category: "medicare" };
  if (category === "marketplace") {
    const planId = sp.get("planId") ?? "";
    const planYear = parseInt(sp.get("planYear") ?? "", 10);
    if (!isValidPlanId(planId)) return { error: "invalid_plan" };
    if (!isValidPlanYear(planYear)) return { error: "invalid_year" };
    return {
      category: "marketplace",
      planId,
      planName: sp.get("planName") ?? "Selected plan",
      issuerName: sp.get("issuerName") ?? "",
      planYear,
    };
  }
  if (category === "other") {
    return { category: "other", insurerName: sp.get("insurerName") || undefined };
  }
  return { category: "none" };
}
