// Where a search goes next: which questions the question page asks, and the
// URLs the search panel and question page send people to.
import type { Place } from "./locationInput";

export type Category = "none" | "medicare" | "marketplace" | "other";
export type Within = 1 | 3 | 5 | 10;
export const DISTANCE_CHOICES: readonly Within[] = [1, 3, 5, 10];
export type Step = "location" | "name" | "insurance" | "plan" | "insurer" | "specialty" | "distance";

export const CATEGORIES: readonly Category[] = ["none", "medicare", "marketplace", "other"];

// The four insurance answers, in the order the search panel shows them.
export const INSURANCE_CHOICES: readonly { value: Category; title: string; detail: string }[] = [
  { value: "medicare", title: "Medicare", detail: "Original Medicare" },
  { value: "marketplace", title: "ACA Marketplace", detail: "HealthCare.gov plans" },
  { value: "other", title: "Employer or other", detail: "Aetna, Blue Cross, …" },
  { value: "none", title: "Skip for now", detail: "Show all doctors" },
];

function insuranceDetail(category: Category | null): Step[] {
  if (category === "marketplace") return ["plan"];
  if (category === "other") return ["insurer"];
  return [];
}

// askInsurance is fixed when the page opens (no insurance chosen yet), so the
// insurance step stays in the path after it's answered and Back still works.
export function questionSteps(s: { byName: boolean; hasPlace: boolean; askInsurance: boolean; category: Category | null }): Step[] {
  const insurance: Step[] = [...(s.askInsurance ? ["insurance" as const] : []), ...insuranceDetail(s.category)];
  if (s.byName) return ["name", ...insurance];
  return [...(s.hasPlace ? [] : ["location" as const]), ...insurance, "specialty", "distance"];
}

export function placeParams(place: Place): URLSearchParams {
  return new URLSearchParams("zip" in place ? { zip: place.zip } : { lat: place.lat, lng: place.lng });
}

// ACA checks need an exact plan, so ACA always visits the question page.
export function panelDestination(c: { place: Place; category: Category | null; more: boolean }): string {
  const q = placeParams(c.place);
  q.set("category", c.category ?? "none");
  const page = c.more || c.category === "marketplace" ? "/search" : "/results";
  return `${page}?${q}`;
}

export type ResultsLink = {
  place?: Place;
  name?: string;
  state?: string;
  category: Category;
  specialty?: string;
  within?: Within | null;
  planId?: string;
  planName?: string;
  issuerName?: string;
  planYear?: number;
  insurerName?: string;
  acaPlanSkipped?: boolean;
};

export function resultsHref(r: ResultsLink): string {
  const q = r.place ? placeParams(r.place) : new URLSearchParams();
  if (r.name) q.set("name", r.name);
  if (r.state) q.set("state", r.state);
  // The API rejects a marketplace search with no plan, so a skipped plan
  // searches without a coverage check and the results page says so.
  const noPlan = r.category === "marketplace" && (r.acaPlanSkipped || !r.planId);
  q.set("category", noPlan ? "none" : r.category);
  if (r.category === "marketplace" && !noPlan) {
    q.set("planId", r.planId ?? "");
    if (r.planName) q.set("planName", r.planName);
    if (r.issuerName) q.set("issuerName", r.issuerName);
    if (r.planYear) q.set("planYear", String(r.planYear));
  }
  if (r.category === "other" && r.insurerName) q.set("insurerName", r.insurerName);
  if (noPlan) q.set("noPlan", "1");
  if (r.specialty) q.set("specialty", r.specialty);
  if (r.within) q.set("within", String(r.within));
  return `/results?${q}`;
}

export function coverageCheckingText(category: Category): string {
  if (category === "medicare") return "Checking Medicare…";
  if (category === "marketplace") return "Checking your plan…";
  return "Checking your insurance…";
}
