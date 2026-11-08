export const COVERAGE_LABELS = {
  "unsupported": "This insurance plan is not currently verified by this website.",
  "unavailable": "Verification temporarily unavailable",
  "notConfigured": "Insurance verification is not configured on this site yet",
  "medicareAssigned": "Accepts the Medicare-approved amount as payment in full",
  "medicareMaybe": "May accept Medicare assignment — verify before the visit",
  "medicareUnknown": "Unable to verify Original Medicare assignment",
  "marketplaceCovered": "Listed as covered by this ACA Marketplace plan",
  "marketplaceNotCovered": "Listed as not covered by this ACA Marketplace plan",
  "marketplaceUnknown": "Unable to verify from Marketplace data"
} as const;
export const COVERAGE_CONFIRMATION = "Confirm the exact plan, office, service, and patient availability with the provider and insurer before a visit.";

// Shared shape for every insurance-verification result shown in the UI.
// Every screen (list, map, profile) renders this same structure so the
// meaning of a status never drifts between components.
export type CoverageStatus =
  | "covered"
  | "not_covered"
  | "unknown"
  | "unavailable"
  | "unsupported";

export type CoverageDisplay = {
  status: CoverageStatus;
  label: string;
  source: string | null;
  checkedAt: string;
  sourceUpdatedAt?: string;
  planName?: string;
  issuerName?: string;
  planYear?: number;
  accepting?: string;
  note?: string;
  providerAddress?: string;
};

// Map pin / marker color. Green is reserved for a real "covered" result —
// every other state (including "we don't know") uses a neutral color.
export function coverageMarkerColor(status: CoverageStatus | undefined): string {
  if (status === "covered") return "var(--ok-ink)";
  if (status === "not_covered") return "var(--danger)";
  return "var(--primary)";
}

export function unsupportedCoverage(insurerName?: string): CoverageDisplay {
  return {
    status: "unsupported",
    label: COVERAGE_LABELS.unsupported,
    source: null,
    checkedAt: new Date().toISOString(),
    note: insurerName
      ? `Check your ${insurerName} member ID card or its official provider directory.`
      : "Check your member ID card or the insurer's official provider directory.",
  };
}
