// Filters applied to results that are already loaded. "How far" uses each
// provider's real computed distance; providers with no mapped address can't
// be measured, so they're hidden (and counted) only while a distance is set.
import { DISTANCE_CHOICES, type Within } from "./searchFlow";

export function parseWithin(value: string | null): Within | null {
  const n = Number(value);
  return DISTANCE_CHOICES.find((choice) => choice === n) ?? null;
}

export function applyResultFilters<T extends { distanceMi: number | null; coverage?: { status: string } }>(
  doctors: T[],
  f: { within: Within | null; onlyCovered: boolean }
): { shown: T[]; hiddenNoLocation: number } {
  let hiddenNoLocation = 0;
  const shown = doctors.filter((d) => {
    if (f.onlyCovered && d.coverage?.status !== "covered") return false;
    if (f.within === null) return true;
    if (d.distanceMi === null) { hiddenNoLocation++; return false; }
    return d.distanceMi <= f.within;
  });
  return { shown, hiddenNoLocation };
}
