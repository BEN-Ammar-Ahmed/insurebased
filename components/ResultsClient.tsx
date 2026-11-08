"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Doctor } from "@/lib/npi";
import type { LatLng } from "@/lib/geo";
import { COVERAGE_LABELS, type CoverageDisplay } from "@/lib/coverage";
import { describeFailure } from "@/lib/failures";
import { applyResultFilters, parseWithin } from "@/lib/resultFilters";
import { CATEGORIES, coverageCheckingText, repairLegacyResultsParams, type Category } from "@/lib/searchFlow";
import { specialtyByLabel } from "@/lib/specialties";
import DoctorCard from "./DoctorCard";
import LazyResultsMap from "./LazyResultsMap";
import SkeletonCards from "./Skeleton";
import SearchPanel from "./SearchPanel";
import ResultsFilters, { type FilterState } from "./ResultsFilters";
import { ListIcon, MapIcon } from "./Icons";
import { useSearchDisclosure } from "./useSearchDisclosure";

type ApiDoctor = Doctor & { coverage?: CoverageDisplay };
type ApiData = { center: LatLng | null; zip?: string | null; doctors: ApiDoctor[]; hasMore: boolean; nextSkip?: number };

// Filters that only change what's shown, never what's fetched.
const VIEW_ONLY_PARAMS = ["within", "noPlan"];
// Params that describe where to search, not which insurance to check.
const PLACE_PARAMS = ["zip", "lat", "lng", "specialty", "name", "state", "skip", "mode", ...VIEW_ONLY_PARAMS];
const PLAN_PARAMS = ["planId", "planName", "issuerName", "planYear", "insurerName", "noPlan"];

function insuranceLabel(sp: URLSearchParams): string {
  const category = sp.get("category");
  if (sp.get("noPlan") === "1") return "ACA Marketplace · coverage not checked (no plan chosen)";
  if (category === "medicare") return "Original Medicare";
  if (category === "marketplace") return sp.get("planName") || "ACA Marketplace plan";
  if (category === "other") return sp.get("insurerName") || "Other insurance";
  return "";
}

export default function ResultsClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const queryString = sp.toString();
  // Old shared ACA links had an empty plan, which the API rejects.
  const repaired = useMemo(() => repairLegacyResultsParams(new URLSearchParams(queryString)), [queryString]);
  useEffect(() => { if (repaired) router.replace(`/results?${repaired}`); }, [repaired, router]);
  const fetchKey = useMemo(() => {
    const q = new URLSearchParams(queryString);
    VIEW_ONLY_PARAMS.forEach((key) => q.delete(key));
    return q.toString();
  }, [queryString]);
  const rawCategory = sp.get("category") ?? "none";
  const category: Category = CATEGORIES.includes(rawCategory as Category) ? (rawCategory as Category) : "none";
  const checksCoverage = category !== "none";
  const byName = Boolean(sp.get("name"));
  const specialty = sp.get("specialty") ?? "";
  const within = byName ? null : parseWithin(sp.get("within"));

  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [view, setView] = useState("list");
  const [onlyCovered, setOnlyCovered] = useState(false);
  const { open: editing, setOpen: setEditing, close: closeEditing, opener: editOpener, area: editArea } = useSearchDisclosure<HTMLButtonElement>();
  const [area, setArea] = useState<LatLng | null>(null);
  const [pendingCoverage, setPendingCoverage] = useState<Set<string>>(new Set());
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const requestedCoverage = useRef(new Set<string>());

  const fetchData = useCallback(async (skip = 0, override?: LatLng | null) => {
    const id = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    if (skip) setLoadingMore(true); else { setLoading(true); setData(null); requestedCoverage.current = new Set(); setPendingCoverage(new Set()); }
    setError(null);
    const query = new URLSearchParams(fetchKey);
    query.set("skip", String(skip));
    if (override) { query.delete("zip"); query.set("lat", String(override.lat)); query.set("lng", String(override.lng)); }
    try {
      const response = await fetch("/api/doctors/search?" + query, { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "request_failed");
      if (id !== generation.current) return;
      setData(previous => skip && previous ? {
        ...payload, doctors: [...new Map([...previous.doctors, ...payload.doctors].map((d: ApiDoctor) => [d.npi, d])).values()]
      } : payload);
    } catch (failure) {
      if (id === generation.current) setError(controller.signal.aborted ? "timeout" : failure instanceof Error ? failure.message : "request_failed");
    } finally {
      window.clearTimeout(timeout);
      if (id === generation.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [fetchKey]);

  useEffect(() => {
    if (repaired) return;
    setArea(null); setOnlyCovered(false); setView("list"); closeEditing(false);
    void fetchData();
    return () => { request.current?.abort(); };
  }, [fetchData, repaired, closeEditing]);

  // Coverage comes from slower official sources, so it loads after the list
  // and fills in each card's badge when it returns.
  useEffect(() => {
    if (!data || !checksCoverage) return;
    const missing = data.doctors.filter(d => !d.coverage && !requestedCoverage.current.has(d.npi)).map(d => d.npi);
    if (!missing.length) return;
    missing.forEach(npi => requestedCoverage.current.add(npi));
    setPendingCoverage(previous => new Set([...previous, ...missing]));
    const id = generation.current;
    const query = new URLSearchParams(fetchKey);
    for (const key of PLACE_PARAMS) query.delete(key);
    query.set("npis", missing.join(","));
    const markDone = (results: Record<string, CoverageDisplay>) => {
      if (id !== generation.current) return;
      setData(previous => previous ? { ...previous, doctors: previous.doctors.map(d => results[d.npi] ? { ...d, coverage: results[d.npi] } : d) } : previous);
      setPendingCoverage(previous => { const next = new Set(previous); missing.forEach(npi => next.delete(npi)); return next; });
    };
    fetch("/api/doctors/coverage?" + query, { signal: AbortSignal.timeout(30000) })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then(payload => markDone(payload.coverage ?? {}))
      .catch(() => {
        const checkedAt = new Date().toISOString();
        markDone(Object.fromEntries(missing.map(npi => [npi, { status: "unavailable", label: COVERAGE_LABELS.unavailable, source: null, checkedAt } satisfies CoverageDisplay])));
      });
  }, [data, checksCoverage, fetchKey]);

  // Kind of doctor and distance live in the URL so a results link can be shared.
  function replaceParams(changes: Record<string, string | null>) {
    const q = new URLSearchParams(queryString);
    for (const [key, value] of Object.entries(changes)) {
      if (value) q.set(key, value); else q.delete(key);
    }
    router.replace(`/results?${q}`, { scroll: false });
  }
  function changeFilters(next: FilterState) {
    setOnlyCovered(next.onlyCovered);
    if (next.specialty !== specialty || next.within !== within) {
      replaceParams({ specialty: next.specialty || null, within: next.within ? String(next.within) : null });
    }
  }
  function showAllDoctors() {
    replaceParams({ category: "none", ...Object.fromEntries(PLAN_PARAMS.map((key) => [key, null])) });
  }

  const { shown, hiddenNoLocation } = useMemo(
    () => applyResultFilters(data?.doctors ?? [], { within, onlyCovered }),
    [data, within, onlyCovered]
  );
  const coveredCount = (data?.doctors ?? []).filter(d => d.coverage?.status === "covered").length;
  const checkingCount = pendingCoverage.size;
  const unplaced = shown.filter(d => d.lat === null || d.lng === null).length;

  const detail = new URLSearchParams(fetchKey);
  for (const key of PLACE_PARAMS) detail.delete(key);
  const detailQuery = detail.size ? "?" + detail : "";

  const place = byName ? `named “${sp.get("name")}”${sp.get("state") ? " in " + sp.get("state") : ""}` : area ? "in this map area" : `near ${sp.get("zip") || data?.zip || "your location"}`;
  const summary = [specialty ? specialtyByLabel(specialty)?.plain ?? specialty : "", insuranceLabel(sp)].filter(Boolean).join(" · ");
  const failure = error ? describeFailure(error, typeof navigator === "undefined" ? true : navigator.onLine) : null;
  const lat = sp.get("lat"), lng = sp.get("lng");
  const panelInitial = {
    location: sp.get("zip") ?? "",
    place: lat && lng ? { lat, lng } : undefined,
    category: sp.get("noPlan") === "1" ? "marketplace" as const : category,
  };
  const filtersActive = Boolean(specialty || within);

  return <main className="screen results-screen">
    <div className="results-top" ref={editArea}>
    <div className="results-head">
      <div>
        <h1 className="results-title">Doctors {place}</h1>
        {summary && <p className="results-subtitle">{summary}</p>}
      </div>
      <button ref={editOpener} type="button" className="btn-secondary results-edit" aria-expanded={editing} onClick={() => (editing ? closeEditing() : setEditing(true))}>Edit search</button>
    </div>
    {editing && <SearchPanel titleId="edit-search-title" initial={panelInitial} onClose={() => closeEditing()} onNavigate={() => closeEditing(false)} />}
    </div>

    {!byName && (
      <ResultsFilters
        value={{ specialty, within, onlyCovered }}
        showSpecialty showDistance
        showOnlyCovered={category === "medicare" || category === "marketplace"}
        onlyCoveredDisabled={checkingCount > 0 && coveredCount === 0}
        onChange={changeFilters} />
    )}

    {loading && <SkeletonCards />}
    {failure && <section className="card empty-card" role="alert">
      <h2 className="empty-card-title">{failure.title}</h2>
      <p className="empty-card-body">{failure.body}</p>
      <div className="empty-card-actions">
        <button className="btn-primary" onClick={() => void fetchData(data?.doctors.length ?? 0, area)}>Try again</button>
        <button className="btn-secondary" onClick={() => setEditing(true)}>Edit search</button>
      </div>
    </section>}
    {!loading && !failure && data && data.doctors.length === 0 && <section className="card empty-card">
      <h2 className="empty-card-title">No doctors found here.</h2>
      <p className="empty-card-body">Try a nearby ZIP code{filtersActive ? ", remove a filter" : ""}{category !== "none" ? ", or show all doctors without the insurance check" : ""}.</p>
      <div className="empty-card-actions">
        {filtersActive && <button className="btn-secondary" onClick={() => replaceParams({ specialty: null, within: null })}>Remove filters</button>}
        {category !== "none" && <button className="btn-secondary" onClick={showAllDoctors}>Show all doctors</button>}
        <button className="btn-primary" onClick={() => setEditing(true)}>Try a nearby ZIP code</button>
      </div>
    </section>}
    {!loading && data && data.doctors.length > 0 && <>
      <div className="results-bar">
        <p className="results-summary" role="status">
          {shown.length} doctor{shown.length === 1 ? "" : "s"}{!byName ? ", closest first" : ""}
          {hiddenNoLocation > 0 && `, ${hiddenNoLocation} without a mapped address hidden`}
          {checkingCount > 0 && <span className="results-checking"> · {coverageCheckingText(category)}</span>}
        </p>
        <div className="pill-toggle results-view-toggle" role="group" aria-label="Results view">
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><ListIcon size={18} />List</button>
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} disabled={!data.center}><MapIcon size={18} />Map</button>
        </div>
      </div>
      <div className="results-workspace" data-view={view}>
        <section className="results-list" aria-label="Provider results">
          {shown.length === 0 && <p>No loaded doctors match these filters.</p>}
          {shown.map(d => <DoctorCard key={d.npi} doctor={d} query={detailQuery} pendingText={pendingCoverage.has(d.npi) ? coverageCheckingText(category) : undefined} />)}
          {data.hasMore && <button className="btn-secondary load-more" disabled={loadingMore} onClick={() => void fetchData(data.nextSkip ?? data.doctors.length, area)}>{loadingMore ? "Loading…" : "Load more doctors"}</button>}
        </section>
        <aside className="results-map-panel" aria-label="Provider map">
          {data.center
            ? <LazyResultsMap center={data.center} doctors={shown} query={detailQuery} onSearchArea={byName ? undefined : (lat, lng) => { const next = { lat, lng }; setArea(next); void fetchData(0, next); }} />
            : <div className="card"><h2 className="empty-card-title">Map unavailable</h2><p className="empty-card-body">Addresses are still in the list.</p></div>}
          {data.center && unplaced > 0 && <p className="map-note">{unplaced} of these doctors couldn&apos;t be placed on the map. They&apos;re still in the list.</p>}
        </aside>
      </div>
    </>}
    <p className="disclaimer">From the official NPI Registry. Records can be out of date. Call the office to confirm they take your plan and are seeing new patients.</p>
  </main>;
}
