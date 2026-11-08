"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Doctor } from "@/lib/npi";
import { COVERAGE_LABELS, type CoverageDisplay } from "@/lib/coverage";
import { homepageFor } from "@/lib/insurers";
import { describeFailure } from "@/lib/failures";
import { CATEGORIES, coverageCheckingText, type Category } from "@/lib/searchFlow";
import { uniquePracticeLocations } from "@/lib/maps";
import LazyResultsMap from "./LazyResultsMap";
import {
  ChevronLeftIcon,
  ExternalLinkIcon,
  MapPinIcon,
  PhoneIcon,
  RefreshIcon,
} from "./Icons";
import { CoverageBadge, CoverageCaption } from "./CoverageBadge";
import { DirectionsChoices } from "./DirectionsLinks";

type Props = {
  npi: string;
  category: string;
  planId: string;
  planName: string;
  issuerName: string;
  planYear: string;
  insurerName: string;
  // Server-rendered record, so the page has real content without JavaScript.
  initialDoctor?: Doctor | null;
  // Server-streamed Original Medicare status (replaces the client fetch).
  medicareSlot?: ReactNode;
  // Link to the matching city directory page, when one exists.
  moreLink?: { href: string; label: string } | null;
};

export default function DoctorProfile({
  npi,
  category,
  planId,
  planName,
  issuerName,
  planYear,
  insurerName,
  initialDoctor = null,
  medicareSlot,
  moreLink,
}: Props) {
  const [doctor, setDoctor] = useState<Doctor | null>(initialDoctor);
  const [coverage, setCoverage] = useState<CoverageDisplay | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialDoctor);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (category !== "none") q.set("category", category);
    if (category === "marketplace") {
      q.set("planId", planId);
      q.set("planName", planName);
      q.set("issuerName", issuerName);
      q.set("planYear", planYear);
    }
    if (category === "other" && insurerName) q.set("insurerName", insurerName);
    return q;
  }, [category, planId, planName, issuerName, planYear, insurerName]);

  const load = useCallback(() => {
    setError(null); setDoctor(null); setLoading(true);
    fetch("/api/doctors/" + npi + "?" + query, { signal: AbortSignal.timeout(30000) })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "not_found" : "unavailable");
        return r.json();
      })
      .then((d) => {
        setDoctor(d.doctor);
        if (d.doctor?.coverage) setCoverage(d.doctor.coverage);
      })
      .catch((e) => setError(e instanceof Error && e.message === "not_found" ? "not_found" : e instanceof Error && e.name === "TimeoutError" ? "timeout" : "unavailable"))
      .finally(() => setLoading(false));
  }, [npi, query]);

  useEffect(() => { if (!initialDoctor) load(); }, [load, initialDoctor]);

  // Coverage loads on its own so the profile never waits on a slow source.
  useEffect(() => {
    if (!doctor || coverage || medicareSlot || !["medicare", "marketplace", "other"].includes(category)) return;
    let cancelled = false;
    setCoverageLoading(true);
    const q = new URLSearchParams(query);
    q.set("npis", doctor.npi);
    fetch("/api/doctors/coverage?" + q, { signal: AbortSignal.timeout(30000) })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then(payload => { if (!cancelled) setCoverage(payload.coverage?.[doctor.npi] ?? null); })
      .catch(() => { if (!cancelled) setCoverage({ status: "unavailable", label: COVERAGE_LABELS.unavailable, source: null, checkedAt: new Date().toISOString() }); })
      .finally(() => { if (!cancelled) setCoverageLoading(false); });
    return () => { cancelled = true; };
  }, [doctor, coverage, category, query, medicareSlot]);

  const categoryValue: Category = CATEGORIES.includes(category as Category) ? (category as Category) : "none";
  const failure = !error ? null
    : error === "not_found" ? { title: "We can't find this provider", body: "The NPI number may be wrong, or the record is no longer listed." }
    : describeFailure(error, typeof navigator === "undefined" ? true : navigator.onLine);

  const practiceLocations = doctor ? uniquePracticeLocations(doctor) : [];
  const otherLocations = practiceLocations.slice(1);
  const directoryUrl = insurerName ? homepageFor(insurerName) : null;

  const findOthersHref = (() => {
    const q = new URLSearchParams(query);
    if (doctor) q.set("zip", doctor.zip);
    return `/results?${q}`;
  })();

  return (
    <main className="screen profile-screen">
      <button
        type="button"
        className="link-button profile-back"
        onClick={() => {
          // Visitors from Google have no results page to return to.
          const fromThisSite = document.referrer && new URL(document.referrer).origin === location.origin;
          if (fromThisSite && history.length > 1) history.back();
          else location.assign(moreLink?.href ?? "/");
        }}
      >
        <ChevronLeftIcon size={20} />
        Back
      </button>

      {failure && (
        <section className="card empty-card" role="alert">
          <h1 className="empty-card-title">{failure.title}</h1>
          <p className="empty-card-body">{failure.body}</p>
          <button type="button" className="btn-primary" onClick={load}>
            <RefreshIcon size={18} />
            Try again
          </button>
        </section>
      )}

      {loading && !failure && (
        <div className="profile-skeleton" role="status" aria-label="Loading provider">
          <div className="skeleton" style={{ height: 56, width: "70%" }} />
          <div className="skeleton" style={{ height: 50 }} />
          <div className="skeleton" style={{ height: 90 }} />
        </div>
      )}

      {doctor && (
        <div className="profile-stack">
          <section className="profile-hero-card">
            <div>
              <h1 className="profile-title">{doctor.name}</h1>
              <p className="profile-meta">{doctor.specialty}</p>
            </div>
          </section>

          <div className="profile-main">
            {medicareSlot && (
              <section className="card coverage-card" aria-live="polite">
                <h2 className="profile-card-title">Original Medicare</h2>
                {medicareSlot}
              </section>
            )}
            {!medicareSlot && category !== "none" && (
              <section className="card coverage-card" aria-live="polite">
                <h2 className="profile-card-title">Insurance check</h2>
                {coverageLoading && <span className="badge-neutral" role="status">{coverageCheckingText(categoryValue)}</span>}
                {coverage && (
                  <>
                    <CoverageBadge coverage={coverage} size={13.5} />
                    {coverage.planName && (
                      <p className="profile-plan">
                        {coverage.planName}
                        {coverage.issuerName ? ` · ${coverage.issuerName}` : ""}
                        {coverage.planYear ? ` · ${coverage.planYear}` : ""}
                      </p>
                    )}
                    {coverage.accepting && <p className="profile-note">New-patient status: {coverage.accepting}</p>}
                    {coverage.providerAddress && <p className="profile-note">Address on file with insurer: {coverage.providerAddress}</p>}
                    {coverage.note && <p className="profile-note">{coverage.note}</p>}
                    <CoverageCaption coverage={coverage} />
                    {coverage.status === "unsupported" && directoryUrl && (
                      <a href={directoryUrl} target="_blank" rel="noreferrer" className="chip inline-chip-link">
                        <ExternalLinkIcon size={13} />
                        {insurerName} provider directory
                      </a>
                    )}
                    {coverage.status === "not_covered" && (
                      <Link href={findOthersHref} className="text-action-link">Find nearby providers listed as covered</Link>
                    )}
                  </>
                )}
              </section>
            )}

            <section className="card profile-location-card">
              <h2 className="profile-card-title">Office</h2>
              <div className="profile-address">
                <MapPinIcon size={18} className="fld-icon" />
                <div>
                  <p className="detail-link-title">{doctor.address1}</p>
                  <p className="detail-link-meta">{doctor.city}, {doctor.state} {doctor.zip}</p>
                  {doctor.addressKind === "mailing" && <p className="profile-note">This is a mailing address. Confirm the office location before you go.</p>}
                </div>
              </div>
              <div className="profile-actions">
                {doctor.phone && (
                  <a href={`tel:${doctor.phone.replace(/[^\d+]/g, "")}`} className="btn-primary">
                    <PhoneIcon size={17} />
                    Call {doctor.phone}
                  </a>
                )}
                {doctor.address1 && <DirectionsChoices doctor={doctor} />}
              </div>
            </section>

            {otherLocations.length > 0 && (
              <section className="card">
                <h2 className="profile-card-title">Practice locations on file</h2>
                <div className="practice-location-list">
                  {practiceLocations.map((location, index) => (
                    <div className="practice-location-item" key={`${location.address1}-${index}`}>
                      <p>{location.address1}, {location.city}, {location.state} {location.zip}</p>
                      {location.phone && <a className="text-action-link" href={"tel:" + location.phone.replace(/[^\d+]/g, "")}>Call {location.phone}</a>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="profile-record">
              <p>NPI: {doctor.npi}</p>
              <p>Source: NPI Registry{doctor.sourceUpdatedAt ? " · updated " + doctor.sourceUpdatedAt : ""}</p>
              <div className="profile-record-links">
                <a href={"https://npiregistry.cms.hhs.gov/provider-view/" + doctor.npi} target="_blank" rel="noreferrer">View official record</a>
                <Link href={"/report?npi=" + doctor.npi}>Report incorrect info</Link>
                {moreLink && <Link href={moreLink.href}>{moreLink.label}</Link>}
              </div>
            </section>
          </div>

          {doctor.lat !== null && doctor.lng !== null && (
            <div className="profile-map-panel">
              <LazyResultsMap center={{ lat: doctor.lat, lng: doctor.lng }} doctors={[doctor]} query={`?${query}`} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
