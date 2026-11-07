"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MarketplacePlan } from "@/lib/marketplace";
import { KNOWN_INSURERS } from "@/lib/insurers";
import { SPECIALTIES, US_STATES } from "@/lib/options";
import {
  BriefcaseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LandmarkIcon,
  LocateIcon,
  MapPinIcon,
  SearchIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  UserIcon,
} from "./Icons";

type Category = "none" | "marketplace" | "medicare" | "other";
type Step = "location" | "name" | "insurance" | "plan" | "insurer" | "specialty";
const CURRENT_YEAR = new Date().getFullYear();
const PLAN_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1];

const INSURANCE_OPTIONS: { value: Category; title: string; detail: string; Icon: typeof ShieldCheckIcon }[] = [
  { value: "medicare", title: "Original Medicare", detail: "Checked against official Medicare records", Icon: LandmarkIcon },
  { value: "marketplace", title: "ACA Marketplace plan", detail: "From HealthCare.gov or your state's exchange", Icon: ShieldCheckIcon },
  { value: "other", title: "Employer or other insurance", detail: "We'll point you to your insurer's directory", Icon: BriefcaseIcon },
  { value: "none", title: "Skip the insurance check", detail: "Just show providers near me", Icon: SearchIcon },
];

export type SearchStart = { zip?: string; lat?: string; lng?: string; byName?: boolean };

export default function SearchForm({ start = {} }: { start?: SearchStart }) {
  const router = useRouter();
  const startedWithPlace = Boolean(start.zip || (start.lat && start.lng));
  const [mode, setMode] = useState<"place" | "name">(start.byName ? "name" : "place");
  const [history, setHistory] = useState<Step[]>([start.byName ? "name" : startedWithPlace ? "insurance" : "location"]);
  const step = history[history.length - 1];

  const [zip, setZip] = useState(start.zip ?? "");
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(start.lat && start.lng ? { lat: start.lat, lng: start.lng } : null);
  const [zipErr, setZipErr] = useState("");
  const [locating, setLocating] = useState(false);
  const [docName, setDocName] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [docState, setDocState] = useState("");
  const [category, setCategory] = useState<Category>("none");
  const [otherInsurer, setOtherInsurer] = useState("");

  const [planYear, setPlanYear] = useState(CURRENT_YEAR);
  const [plans, setPlans] = useState<MarketplacePlan[] | null>(null);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [planId, setPlanId] = useState("");
  const [planErr, setPlanErr] = useState("");

  useEffect(() => {
    setPlans(null);
    setPlanId("");
    setPlansError(""); setPlansLoading(false);
    if (step !== "plan" || !/^\d{5}$/.test(zip)) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setPlansLoading(true);
    fetch(`/api/insurance/marketplace/plans?zip=${zip}&year=${planYear}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setPlans(d.plans ?? []);
        if (!d.plans?.length) setPlansError("No Marketplace plans found for this ZIP and year.");
      })
      .catch((e) => {
        if (cancelled) return;
        setPlansError(
          e.message === "503"
            ? "Marketplace plan checks aren't set up on this site yet. Go back and skip the insurance check, or choose another option."
            : "Couldn't load Marketplace plans right now. Try again in a moment."
        );
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!cancelled) setPlansLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout); controller.abort();
    };
  }, [step, zip, planYear]);

  function go(next: Step) { setHistory(h => [...h, next]); }
  function back() {
    if (history.length > 1) setHistory(h => h.slice(0, -1));
    else router.back();
  }

  // The full path for the current choices, used for the progress indicator.
  const path: Step[] = [
    ...(mode === "name" ? ["name" as const] : startedWithPlace ? [] : ["location" as const]),
    "insurance",
    ...(category === "marketplace" ? ["plan" as const] : category === "other" ? ["insurer" as const] : []),
    ...(mode === "place" ? ["specialty" as const] : []),
  ];
  const stepNumber = Math.max(1, path.indexOf(step) + 1);

  function submit(specialty = "") {
    const q = new URLSearchParams();
    if (mode === "name") {
      q.set("name", docName.trim());
      if (docState) q.set("state", docState);
    } else if (coords && !zip) {
      q.set("lat", coords.lat); q.set("lng", coords.lng);
    } else {
      q.set("zip", zip);
    }
    if (specialty) q.set("specialty", specialty);
    q.set("category", category);
    if (category === "marketplace") {
      const plan = plans?.find((p) => p.id === planId);
      q.set("planId", planId);
      if (plan) { q.set("planName", plan.name); q.set("issuerName", plan.issuerName); }
      q.set("planYear", String(planYear));
    }
    if (category === "other" && otherInsurer.trim()) q.set("insurerName", otherInsurer.trim());
    router.push(`/results?${q}`);
  }

  function afterInsurance(choice: Category) {
    setCategory(choice);
    if (choice === "marketplace") go("plan");
    else if (choice === "other") go("insurer");
    else if (mode === "place") go("specialty");
    else submitWith(choice);
  }
  // Category state updates async; name searches with no further steps submit directly.
  function submitWith(choice: Category) {
    const q = new URLSearchParams({ name: docName.trim(), category: choice });
    if (docState) q.set("state", docState);
    router.push(`/results?${q}`);
  }
  function afterCoverageDetail() {
    if (mode === "place") go("specialty"); else submit();
  }

  function locate() {
    if (!navigator.geolocation) { setZipErr("Location isn't available on this device. Enter a ZIP code instead."); return; }
    setZipErr(""); setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => { setLocating(false); setZip(""); setCoords({ lat: c.latitude.toFixed(5), lng: c.longitude.toFixed(5) }); go("insurance"); },
      () => { setLocating(false); setZipErr("Location was blocked or timed out. Enter a ZIP code instead."); },
      { timeout: 8000, maximumAge: 300000 }
    );
  }

  return (
    <div className="wizard">
      <div className="wizard-top">
        <button type="button" className="wizard-back" onClick={back}><ChevronLeftIcon size={18} />Back</button>
        <span className="wizard-count">Step {stepNumber} of {path.length}</span>
      </div>
      <div className="wizard-progress" aria-hidden="true"><span style={{ width: `${(stepNumber / path.length) * 100}%` }} /></div>

      {step === "location" && (
        <form className="wizard-step" noValidate onSubmit={(e) => { e.preventDefault(); if (!/^\d{5}$/.test(zip)) { setZipErr("Enter a 5-digit ZIP code"); return; } setCoords(null); go("insurance"); }}>
          <h1 className="wizard-question">Where should we look for providers?</h1>
          <div className="form-group">
            <label className="lbl" htmlFor="zip">ZIP code</label>
            <div className="fld fld-large">
              <MapPinIcon size={20} className="fld-icon" />
              <input id="zip" name="zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="e.g. 60614" value={zip} autoFocus
                onChange={(e) => { setZip(e.target.value.replace(/\D/g, "")); setZipErr(""); }}
                aria-invalid={!!zipErr} aria-describedby={zipErr ? "zip-error" : undefined} />
            </div>
            {zipErr && <p id="zip-error" role="alert" className="err-text">{zipErr}</p>}
          </div>
          <button type="submit" className="btn-primary wizard-continue">Continue<ChevronRightIcon size={18} /></button>
          <button type="button" className="wizard-alt" onClick={locate} disabled={locating}><LocateIcon size={17} />{locating ? "Finding your location…" : "Use my current location"}</button>
          <button type="button" className="wizard-alt" onClick={() => { setMode("name"); setHistory(["name"]); }}><UserIcon size={17} />Search by a provider&apos;s name instead</button>
        </form>
      )}

      {step === "name" && (
        <form className="wizard-step" noValidate onSubmit={(e) => { e.preventDefault(); if (docName.trim().length < 2) { setNameErr("Enter at least 2 letters of the name"); return; } go("insurance"); }}>
          <h1 className="wizard-question">Who are you looking for?</h1>
          <div className="form-group">
            <label className="lbl" htmlFor="dname">Provider name</label>
            <div className="fld fld-large">
              <SearchIcon size={20} className="fld-icon" />
              <input id="dname" name="doctorName" placeholder="Last name, or first and last" value={docName} autoFocus
                onChange={(e) => { setDocName(e.target.value); setNameErr(""); }}
                aria-invalid={!!nameErr} aria-describedby={nameErr ? "name-error" : undefined} />
            </div>
            {nameErr && <p id="name-error" role="alert" className="err-text">{nameErr}</p>}
          </div>
          <div className="form-group">
            <label className="lbl" htmlFor="dstate">State <span className="lbl-optional">(optional)</span></label>
            <div className="fld">
              <MapPinIcon size={18} className="fld-icon" />
              <select id="dstate" name="doctorState" value={docState} onChange={(e) => setDocState(e.target.value)}>
                <option value="">Any state</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary wizard-continue">Continue<ChevronRightIcon size={18} /></button>
          <button type="button" className="wizard-alt" onClick={() => { setMode("place"); setHistory([startedWithPlace ? "insurance" : "location"]); }}><MapPinIcon size={17} />Search by location instead</button>
        </form>
      )}

      {step === "insurance" && (
        <div className="wizard-step">
          <h1 className="wizard-question">What insurance do you have?</h1>
          <p className="wizard-help">We&apos;ll check providers against official records where they exist, and tell you plainly when we can&apos;t.</p>
          <ul className="choice-list">
            {INSURANCE_OPTIONS.map(({ value, title, detail, Icon }) => (
              <li key={value}>
                <button type="button" className="choice-card" onClick={() => afterInsurance(value)}>
                  <span className="choice-icon"><Icon size={22} /></span>
                  <span className="choice-text"><span className="choice-title">{title}</span><span className="choice-detail">{detail}</span></span>
                  <ChevronRightIcon size={18} className="choice-chevron" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === "plan" && (
        <form className="wizard-step" noValidate onSubmit={(e) => { e.preventDefault(); if (!planId) { setPlanErr("Choose your plan to continue"); return; } afterCoverageDetail(); }}>
          <h1 className="wizard-question">Which Marketplace plan are you on?</h1>
          <p className="wizard-help">The plan name is on your insurance card or HealthCare.gov account.</p>
          {!/^\d{5}$/.test(zip) && (
            <div className="form-group">
              <label className="lbl" htmlFor="planZip">Your ZIP code</label>
              <div className="fld"><MapPinIcon size={18} className="fld-icon" />
                <input id="planZip" inputMode="numeric" maxLength={5} placeholder="e.g. 60614" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} /></div>
            </div>
          )}
          <div className="form-group">
            <label className="lbl" htmlFor="planYear">Plan year</label>
            <div className="fld">
              <select id="planYear" name="planYear" value={planYear} onChange={(e) => setPlanYear(parseInt(e.target.value, 10))}>
                {PLAN_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="lbl" htmlFor="plan">Plan</label>
            <div className="fld">
              <select id="plan" name="planId" value={planId} onChange={(e) => { setPlanId(e.target.value); setPlanErr(""); }} disabled={!plans || plans.length === 0}>
                <option value="">{plansLoading ? "Loading plans…" : plans?.length ? "Choose your plan" : /^\d{5}$/.test(zip) ? "No plans loaded" : "Enter a ZIP code first"}</option>
                {plans?.map((p) => <option key={p.id} value={p.id}>{p.issuerName} — {p.name} ({p.metalLevel})</option>)}
              </select>
            </div>
            {plansError && <p className="err-text">{plansError}</p>}
            {planErr && <p className="err-text" role="alert">{planErr}</p>}
          </div>
          <button type="submit" className="btn-primary wizard-continue">Continue<ChevronRightIcon size={18} /></button>
        </form>
      )}

      {step === "insurer" && (
        <form className="wizard-step" noValidate onSubmit={(e) => { e.preventDefault(); afterCoverageDetail(); }}>
          <h1 className="wizard-question">Who is your insurance company?</h1>
          <p className="wizard-help">There&apos;s no free official source for employer plans, so we won&apos;t guess. We&apos;ll link you to your insurer&apos;s own provider directory to confirm.</p>
          <div className="form-group">
            <label className="lbl" htmlFor="otherIns">Insurance company <span className="lbl-optional">(optional)</span></label>
            <div className="fld fld-large">
              <BriefcaseIcon size={20} className="fld-icon" />
              <input id="otherIns" name="otherInsurer" list="known-insurers" placeholder="e.g. Aetna" value={otherInsurer} onChange={(e) => setOtherInsurer(e.target.value)} />
            </div>
            <datalist id="known-insurers">{KNOWN_INSURERS.map((i) => <option key={i.name} value={i.name} />)}</datalist>
          </div>
          <button type="submit" className="btn-primary wizard-continue">Continue<ChevronRightIcon size={18} /></button>
        </form>
      )}

      {step === "specialty" && (
        <div className="wizard-step">
          <h1 className="wizard-question">What kind of care do you need?</h1>
          <div className="specialty-grid">
            <button type="button" className="specialty-choice specialty-any" onClick={() => submit("")}><StethoscopeIcon size={18} />Show all providers</button>
            {SPECIALTIES.map((s) => (
              <button type="button" key={s} className="specialty-choice" onClick={() => submit(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
