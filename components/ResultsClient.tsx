"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Doctor } from "@/lib/npi";
import type { LatLng } from "@/lib/geo";
import { COVERAGE_LABELS, type CoverageDisplay } from "@/lib/coverage";
import DoctorCard from "./DoctorCard";
import LazyResultsMap from "./LazyResultsMap";
import SkeletonCards from "./Skeleton";
import { ListIcon, MapIcon } from "./Icons";

type ApiDoctor = Doctor & { coverage?: CoverageDisplay };
type ApiData = { center: LatLng | null; zip?: string | null; doctors: ApiDoctor[]; hasMore: boolean; nextSkip?: number };
const errors: Record<string, [string, string]> = {
  invalid_zip: ["Check your ZIP code", "Enter a five-digit US ZIP code and search again."],
  invalid_area: ["Check your location", "Enter a ZIP code to search a valid US area."],
  missing_query: ["Start a search", "Enter a ZIP code or a provider name."],
  rate_limited: ["Too many requests", "Wait a minute before trying again."],
  rate_limit_unavailable: ["Search protection is unavailable", "The service is temporarily unavailable. Try again shortly."],
  area_unresolved: ["Location could not be resolved", "Enter a ZIP code instead."],
};

function insuranceLabel(sp: URLSearchParams): string {
  const category = sp.get("category");
  if (category === "medicare") return "Original Medicare";
  if (category === "marketplace") return sp.get("planName") || "ACA Marketplace plan";
  if (category === "other") return sp.get("insurerName") || "Other insurance";
  return "";
}

export default function ResultsClient() {
  const sp = useSearchParams();
  const queryString = sp.toString();
  const category = sp.get("category") ?? "none";
  const checksCoverage = category === "medicare" || category === "marketplace" || category === "other";
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [view, setView] = useState("list");
  const [filter, setFilter] = useState("");
  const [onlyCovered, setOnlyCovered] = useState(false);
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
    const query = new URLSearchParams(queryString);
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
  }, [queryString]);

  useEffect(() => {
    setArea(null); setFilter(""); setOnlyCovered(false); setView("list");
    void fetchData();
    return () => { request.current?.abort(); };
  }, [fetchData]);

  // Coverage comes from slower official sources, so it loads after the list
  // and fills in each card's badge when it returns.
  useEffect(() => {
    if (!data || !checksCoverage) return;
    const missing = data.doctors.filter(d => !d.coverage && !requestedCoverage.current.has(d.npi)).map(d => d.npi);
    if (!missing.length) return;
    missing.forEach(npi => requestedCoverage.current.add(npi));
    setPendingCoverage(previous => new Set([...previous, ...missing]));
    const id = generation.current;
    const query = new URLSearchParams(queryString);
    for (const key of ["zip", "lat", "lng", "specialty", "name", "state", "skip", "mode"]) query.delete(key);
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
  }, [data, checksCoverage, queryString]);

  const coveredCount = (data?.doctors ?? []).filter(d => d.coverage?.status === "covered").length;
  const filtered = useMemo(
    () => (data?.doctors ?? []).filter(d => (!filter || d.specialty === filter) && (!onlyCovered || d.coverage?.status === "covered")),
    [data, filter, onlyCovered]
  );
  const specialties = [...new Set((data?.doctors ?? []).map(d => d.specialty))].sort();
  const detail = new URLSearchParams(queryString);
  for (const key of ["zip", "lat", "lng", "specialty", "name", "state", "skip", "mode"]) detail.delete(key);
  const detailQuery = detail.size ? "?" + detail : "";
  const place = sp.get("name") ? `“${sp.get("name")}”${sp.get("state") ? " in " + sp.get("state") : ""}` : area ? "this map area" : sp.get("zip") || data?.zip || "your location";
  const summaryParts = [sp.get("specialty"), insuranceLabel(sp)].filter(Boolean);
  const [errorTitle, errorBody] = errors[error ?? ""] ?? ["Provider records are unavailable", "The request failed or timed out. Check your connection and try again."];
  const checkingCount = pendingCoverage.size;

  return <main className="screen results-screen">
    <div className="results-head">
      <div>
        <h1 className="results-title">{sp.get("name") ? "Providers named " : "Providers near "}{place}</h1>
        {summaryParts.length > 0 && <p className="results-subtitle">{summaryParts.join(" · ")}</p>}
      </div>
      <Link className="btn-secondary results-edit" href="/search">Edit search</Link>
    </div>

    {loading && <SkeletonCards />}
    {error && <div className="card empty-card" role="alert"><h2 className="empty-card-title">{errorTitle}</h2><p>{errorBody}</p><button className="btn-primary" onClick={() => void fetchData(data?.doctors.length ?? 0, area)}>Try again</button><Link className="text-action-link" href="/search">Edit search</Link></div>}
    {!loading && data && data.doctors.length === 0 && <section className="card empty-card"><h2>No providers found</h2><p>Try another ZIP code, remove a specialty, or check the provider name.</p><Link className="btn-primary" href="/search">Change search</Link></section>}
    {!loading && data && data.doctors.length > 0 && <>
      <div className="results-controls">
        {specialties.length > 1 && <div className="results-control">
          <label htmlFor="result-specialty">Specialty in these results</label>
          <select id="result-specialty" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All specialties</option>{specialties.map(s => <option key={s}>{s}</option>)}</select>
        </div>}
        {(category === "medicare" || category === "marketplace") && <label className="results-check">
          <input type="checkbox" checked={onlyCovered} onChange={e => setOnlyCovered(e.target.checked)} disabled={checkingCount > 0 && coveredCount === 0} />
          <span>Only verified matches{checkingCount === 0 ? ` (${coveredCount})` : ""}</span>
        </label>}
        <div className="pill-toggle results-view-toggle" role="group" aria-label="Results view">
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><ListIcon size={16} />List</button>
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} disabled={!data.center}><MapIcon size={16} />Map</button>
        </div>
      </div>
      <div className="results-workspace" data-view={view}>
        <section className="results-list" aria-label="Provider results">
          <p className="results-summary" role="status">
            {filtered.length} provider{filtered.length === 1 ? "" : "s"}{!sp.get("name") ? ", closest first" : ""}
            {checkingCount > 0 && <span className="results-checking"> · Checking {insuranceLabel(sp)} records…</span>}
          </p>
          {filtered.length === 0 && <p>No loaded providers match these filters.</p>}
          {filtered.map(d => <DoctorCard key={d.npi} doctor={d} query={detailQuery} coveragePending={pendingCoverage.has(d.npi)} />)}
          {data.hasMore && <button className="btn-secondary load-more" disabled={loadingMore} onClick={() => void fetchData(data.nextSkip ?? data.doctors.length, area)}>{loadingMore ? "Loading…" : "Load more doctors"}</button>}
        </section>
        <aside className="results-map-panel" aria-label="Provider map">
          {data.center ? <LazyResultsMap center={data.center} doctors={filtered} query={detailQuery} onSearchArea={sp.get("name") ? undefined : (lat, lng) => { const next = { lat, lng }; setArea(next); void fetchData(0, next); }} /> : <div className="card"><h2>Map unavailable</h2><p>Provider addresses remain available in the list.</p></div>}
        </aside>
      </div>
    </>}
    <p className="disclaimer">From the official NPI Registry. Records can be out of date — call the office to confirm your plan and that they are taking new patients.</p>
  </main>;
}
