// Server components that render Original Medicare status as it streams in.
// The page sends its provider content right away; each badge waits on one
// shared batch lookup (CMS can take 5–10s) inside a Suspense boundary.
import type { CoverageDisplay } from "@/lib/coverage";
import { CoverageBadge, CoverageCaption } from "./CoverageBadge";

export type CoverageLookup = Promise<Map<string, CoverageDisplay>>;

export function PendingCoverageBadge({ text = "Checking Medicare…" }: { text?: string }) {
  return <span className="badge-neutral" role="status">{text}</span>;
}

export async function MedicareBadge({ npi, lookup }: { npi: string; lookup: CoverageLookup }) {
  const coverage = (await lookup).get(npi);
  return coverage ? <CoverageBadge coverage={coverage} /> : null;
}

export async function MedicareDetails({ npi, lookup }: { npi: string; lookup: CoverageLookup }) {
  const coverage = (await lookup).get(npi);
  if (!coverage) return null;
  return (
    <>
      <CoverageBadge coverage={coverage} size={13.5} />
      {coverage.note && <p className="profile-note">{coverage.note}</p>}
      <CoverageCaption coverage={coverage} />
    </>
  );
}
