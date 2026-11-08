import type { CoverageDisplay } from "@/lib/coverage";
import { CheckIcon, XIcon, HelpCircleIcon } from "./Icons";

function classFor(status: CoverageDisplay["status"]): string {
  if (status === "covered") return "badge-ok";
  if (status === "not_covered") return "badge-no";
  return "badge-neutral";
}

function IconFor({ status, size }: { status: CoverageDisplay["status"]; size: number }) {
  if (status === "covered") return <CheckIcon size={size} />;
  if (status === "not_covered") return <XIcon size={size} />;
  return <HelpCircleIcon size={size} />;
}

export function CoverageBadge({
  coverage,
  size = 13,
}: {
  coverage: CoverageDisplay;
  size?: number;
}) {
  return (
    <span className={classFor(coverage.status)}>
      <IconFor status={coverage.status} size={size} />
      <span className="coverage-badge-label">{coverage.label}</span>
    </span>
  );
}

export function CoverageCaption({ coverage }: { coverage: CoverageDisplay }) {
  if (!coverage.source) return null;
  const when = new Date(coverage.checkedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <p className="coverage-caption">
      Source: {coverage.source} · Checked {when}{coverage.sourceUpdatedAt ? " · Source updated " + coverage.sourceUpdatedAt : ""}
    </p>
  );
}
