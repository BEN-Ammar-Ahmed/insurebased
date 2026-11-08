"use client";
import { useState } from "react";
import { SPECIALTY_LIST, specialtyByLabel } from "@/lib/specialties";
import { DISTANCE_CHOICES, type Within } from "@/lib/searchFlow";

export type FilterState = { specialty: string; within: Within | null; onlyCovered: boolean };

// The same choices as the question page, always available and never required.
// On phones they sit behind a "Filters" button.
export default function ResultsFilters({ value, showOnlyCovered, showDistance, showSpecialty, onlyCoveredDisabled, onChange }: {
  value: FilterState;
  showOnlyCovered: boolean;
  showDistance: boolean;
  showSpecialty: boolean;
  onlyCoveredDisabled?: boolean;
  onChange(next: FilterState): void;
}) {
  const [open, setOpen] = useState(false);
  if (!showOnlyCovered && !showDistance && !showSpecialty) return null;
  const unknownSpecialty = value.specialty && !specialtyByLabel(value.specialty);
  const active = [value.specialty, value.within, value.onlyCovered].filter(Boolean).length;
  return (
    <div className="results-filters" data-open={open}>
      <button type="button" className="btn-secondary results-filters-toggle" aria-expanded={open} aria-controls="results-filter-fields" onClick={() => setOpen(!open)}>
        Filters{active ? ` (${active})` : ""}
      </button>
      <div id="results-filter-fields" className="results-filter-fields">
        {showSpecialty && (
          <div className="results-filter">
            <label className="lbl" htmlFor="filter-specialty">Kind of doctor</label>
            <div className="fld">
              <select id="filter-specialty" value={value.specialty} onChange={(e) => onChange({ ...value, specialty: e.target.value })}>
                <option value="">Any kind</option>
                {unknownSpecialty && <option value={value.specialty}>{value.specialty}</option>}
                {SPECIALTY_LIST.map((s) => <option key={s.slug} value={s.label}>{s.plain}</option>)}
              </select>
            </div>
          </div>
        )}
        {showDistance && (
          <div className="results-filter">
            <label className="lbl" htmlFor="filter-within">How far</label>
            <div className="fld">
              <select id="filter-within" value={value.within ?? ""} onChange={(e) => onChange({ ...value, within: (Number(e.target.value) || null) as Within | null })}>
                <option value="">Any distance</option>
                {DISTANCE_CHOICES.map((mi) => <option key={mi} value={mi}>Within {mi} {mi === 1 ? "mile" : "miles"}</option>)}
              </select>
            </div>
          </div>
        )}
        {showOnlyCovered && (
          <label className="results-check">
            <input type="checkbox" checked={value.onlyCovered} disabled={onlyCoveredDisabled} onChange={(e) => onChange({ ...value, onlyCovered: e.target.checked })} />
            <span>Only doctors confirmed for my insurance</span>
          </label>
        )}
      </div>
    </div>
  );
}
