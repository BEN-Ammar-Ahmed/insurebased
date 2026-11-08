"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MarketplacePlan } from "@/lib/marketplace";
import { KNOWN_INSURERS } from "@/lib/insurers";
import { US_STATES } from "@/lib/options";
import { SPECIALTY_LIST } from "@/lib/specialties";
import type { Place } from "@/lib/locationInput";
import {
  DISTANCE_CHOICES, INSURANCE_CHOICES, questionSteps, resultsHref,
  type Category, type Step, type Within,
} from "@/lib/searchFlow";
import LocationField, { CURRENT_LOCATION_TEXT } from "./LocationField";
import { resolvePlaceFromText } from "./SearchPanel";
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon, SearchIcon, UserIcon } from "./Icons";

const CURRENT_YEAR = new Date().getFullYear();
const PLAN_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1];

const QUESTIONS: Record<Step, string> = {
  location: "Where are you looking?",
  name: "Who are you looking for?",
  insurance: "What insurance do you have?",
  plan: "Which Marketplace plan do you have?",
  insurer: "Who is your insurance company?",
  specialty: "What kind of doctor do you need?",
  distance: "How far are you willing to travel?",
};

export type SearchStart = { place?: Place; byName?: boolean; category?: Category };

type Answers = { category: Category | null; specialty: string; within: Within | null; acaPlanSkipped: boolean };

// One question per screen. Every question after "where" can be skipped, and
// "Skip all" goes straight to results with whatever is known so far.
export default function SearchForm({ start = {} }: { start?: SearchStart }) {
  const router = useRouter();
  const askInsurance = start.category === undefined;
  const askLocation = !start.place;
  const [mode, setMode] = useState<"place" | "name">(start.byName ? "name" : "place");

  const [place, setPlace] = useState<Place | null>(start.place ?? null);
  const [locText, setLocText] = useState("");
  const [gpsPlace, setGpsPlace] = useState<Place | null>(null);
  const [locError, setLocError] = useState("");
  const [locBusy, setLocBusy] = useState(false);

  const [docName, setDocName] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [docState, setDocState] = useState("");

  const [answers, setAnswers] = useState<Answers>({ category: start.category ?? null, specialty: "", within: null, acaPlanSkipped: false });
  const [otherInsurer, setOtherInsurer] = useState("");

  const [planZip, setPlanZip] = useState(start.place && "zip" in start.place ? start.place.zip : "");
  const [planYear, setPlanYear] = useState(CURRENT_YEAR);
  const [plans, setPlans] = useState<MarketplacePlan[] | null>(null);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [plansUnavailable, setPlansUnavailable] = useState(false);
  const [planId, setPlanId] = useState("");
  const [planErr, setPlanErr] = useState("");

  const stepsFor = (category: Category | null, m = mode) =>
    questionSteps({ byName: m === "name", hasPlace: !askLocation, askInsurance, category });
  const steps = stepsFor(answers.category);
  const [history, setHistory] = useState<Step[]>([steps[0]]);
  const step = history[history.length - 1];
  const stepNumber = Math.max(1, steps.indexOf(step) + 1);

  // Move focus to the new question so screen readers announce it.
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus();
  }, [step]);

  // The plan list depends on ZIP and year.
  useEffect(() => {
    setPlans(null); setPlanId(""); setPlansError(""); setPlansUnavailable(false); setPlansLoading(false);
    if (step !== "plan" || !/^\d{5}$/.test(planZip)) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setPlansLoading(true);
    fetch(`/api/insurance/marketplace/plans?zip=${planZip}&year=${planYear}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d) => {
        if (cancelled) return;
        setPlans(d.plans ?? []);
        if (!d.plans?.length) setPlansError("No Marketplace plans found for this ZIP code and year.");
      })
      .catch((e) => {
        if (cancelled) return;
        if (e.message === "503") setPlansUnavailable(true);
        else setPlansError("Couldn't load Marketplace plans right now. Try again in a moment, or skip this question.");
      })
      .finally(() => { window.clearTimeout(timeout); if (!cancelled) setPlansLoading(false); });
    return () => { cancelled = true; window.clearTimeout(timeout); controller.abort(); };
  }, [step, planZip, planYear]);

  function submit(over: Partial<Answers> = {}) {
    const a = { ...answers, ...over };
    const category = a.category ?? "none";
    const plan = plans?.find((p) => p.id === planId);
    const common = {
      category,
      acaPlanSkipped: category === "marketplace" && (a.acaPlanSkipped || !planId),
      ...(category === "marketplace" && planId ? { planId, planName: plan?.name, issuerName: plan?.issuerName, planYear } : {}),
      ...(category === "other" && otherInsurer.trim() ? { insurerName: otherInsurer.trim() } : {}),
    };
    if (mode === "name") {
      router.push(resultsHref({ ...common, name: docName.trim(), state: docState || undefined }));
      return;
    }
    if (!place) { setHistory(["location"]); return; }
    router.push(resultsHref({ ...common, place, specialty: a.specialty || undefined, within: a.within }));
  }

  // Saves the answer, then shows the next question (or the results).
  function next(over: Partial<Answers> = {}) {
    const merged = { ...answers, ...over };
    setAnswers(merged);
    const path = stepsFor(merged.category);
    const following = path[path.indexOf(step) + 1];
    if (following) setHistory((h) => [...h, following]);
    else submit(merged);
  }

  function back() {
    if (history.length > 1) setHistory((h) => h.slice(0, -1));
    else router.back();
  }

  function switchMode(m: "place" | "name") {
    setMode(m);
    setHistory([stepsFor(answers.category, m)[0]]);
  }

  async function submitLocation(e: FormEvent) {
    e.preventDefault();
    let found: Place | null = gpsPlace && locText === CURRENT_LOCATION_TEXT ? gpsPlace : null;
    if (!found) {
      setLocBusy(true);
      const result = await resolvePlaceFromText(locText);
      setLocBusy(false);
      if (!result.place) { setLocError(result.error ?? ""); return; }
      found = result.place;
    }
    setPlace(found);
    if ("zip" in found) setPlanZip(found.zip);
    next();
  }

  const canSkip = step !== "location" && step !== "name";
  const skipAnswer: Partial<Answers> =
    step === "insurance" ? { category: "none" } :
    step === "plan" ? { acaPlanSkipped: true } :
    step === "specialty" ? { specialty: "" } :
    step === "distance" ? { within: null } : {};

  return (
    <div className="wizard">
      <div className="wizard-top">
        <button type="button" className="link-button wizard-back" onClick={back}><ChevronLeftIcon size={20} />Back</button>
        <span className="wizard-count">Question {stepNumber} of {steps.length}</span>
      </div>

      <h1 ref={heading} tabIndex={-1} className="wizard-question">{QUESTIONS[step]}</h1>

      {step === "location" && (
        <form className="wizard-step" noValidate onSubmit={submitLocation}>
          <LocationField id="wizard-location" value={locText} autoFocus error={locError} onError={setLocError}
            onChange={(v) => { setLocText(v); if (gpsPlace) setGpsPlace(null); }}
            onLocated={(p) => { setGpsPlace(p); setLocText(CURRENT_LOCATION_TEXT); }} />
          <button type="submit" className="btn-primary wizard-continue" disabled={locBusy}>{locBusy ? "Finding that address…" : "Continue"}<ChevronRightIcon size={20} /></button>
          <button type="button" className="link-button" onClick={() => switchMode("name")}><UserIcon size={18} />Search by a doctor&apos;s name instead</button>
        </form>
      )}

      {step === "name" && (
        <form className="wizard-step" noValidate onSubmit={(e) => { e.preventDefault(); if (docName.trim().length < 2) { setNameErr("Enter at least 2 letters of the name."); return; } next(); }}>
          <div className="form-group">
            <label className="lbl" htmlFor="dname">Doctor&apos;s name</label>
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
              <select id="dstate" name="doctorState" value={docState} onChange={(e) => setDocState(e.target.value)}>
                <option value="">Any state</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary wizard-continue">Continue<ChevronRightIcon size={20} /></button>
          <button type="button" className="link-button" onClick={() => switchMode("place")}><MapPinIcon size={18} />Search by location instead</button>
        </form>
      )}

      {step === "insurance" && (
        <ul className="choice-list">
          {INSURANCE_CHOICES.map((c) => (
            <li key={c.value}>
              <button type="button" className="choice-card" aria-pressed={answers.category === c.value} onClick={() => next({ category: c.value })}>
                <span className="choice-title">{c.title}</span>
                <span className="choice-detail">{c.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === "plan" && (
        <form className="wizard-step" noValidate onSubmit={(e) => {
          e.preventDefault();
          if (planId) { next({ acaPlanSkipped: false }); return; }
          if (plansUnavailable) { next({ acaPlanSkipped: true }); return; }
          setPlanErr("Choose your plan, or skip this question.");
        }}>
          {plansUnavailable ? (
            <p className="wizard-help" role="status">Plan checks aren&apos;t available on this site yet. You can continue without choosing a plan.</p>
          ) : (
            <>
              <p className="wizard-help">The plan name is on your insurance card or your HealthCare.gov account.</p>
              {!(place && "zip" in place) && (
                <div className="form-group">
                  <label className="lbl" htmlFor="planZip">Your ZIP code</label>
                  <div className="fld"><input id="planZip" inputMode="numeric" maxLength={5} placeholder="e.g. 60614" value={planZip} onChange={(e) => setPlanZip(e.target.value.replace(/\D/g, ""))} /></div>
                </div>
              )}
              <div className="form-group">
                <label className="lbl" htmlFor="planYear">Plan year</label>
                <div className="fld">
                  <select id="planYear" value={planYear} onChange={(e) => setPlanYear(parseInt(e.target.value, 10))}>
                    {PLAN_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="lbl" htmlFor="plan">Plan</label>
                <div className="fld">
                  <select id="plan" value={planId} onChange={(e) => { setPlanId(e.target.value); setPlanErr(""); }} disabled={!plans || plans.length === 0}
                    aria-describedby={planErr ? "plan-error" : undefined}>
                    <option value="">{plansLoading ? "Loading plans…" : plans?.length ? "Choose your plan" : /^\d{5}$/.test(planZip) ? "No plans loaded" : "Enter a ZIP code first"}</option>
                    {plans?.map((p) => <option key={p.id} value={p.id}>{p.issuerName} — {p.name} ({p.metalLevel})</option>)}
                  </select>
                </div>
                {plansError && <p className="err-text">{plansError}</p>}
                {planErr && <p id="plan-error" className="err-text" role="alert">{planErr}</p>}
              </div>
            </>
          )}
          <button type="submit" className="btn-primary wizard-continue">{plansUnavailable ? "Continue without a plan" : "Continue"}<ChevronRightIcon size={20} /></button>
        </form>
      )}

      {step === "insurer" && (
        <form className="wizard-step" noValidate onSubmit={(e) => { e.preventDefault(); next(); }}>
          <p className="wizard-help">There&apos;s no free official list for employer plans, so we won&apos;t guess. We&apos;ll link you to your insurer&apos;s own directory to confirm.</p>
          <div className="form-group">
            <label className="lbl" htmlFor="otherIns">Insurance company <span className="lbl-optional">(optional)</span></label>
            <div className="fld fld-large">
              <input id="otherIns" name="otherInsurer" list="known-insurers" placeholder="e.g. Aetna" value={otherInsurer} onChange={(e) => setOtherInsurer(e.target.value)} />
            </div>
            <datalist id="known-insurers">{KNOWN_INSURERS.map((i) => <option key={i.name} value={i.name} />)}</datalist>
          </div>
          <button type="submit" className="btn-primary wizard-continue">Continue<ChevronRightIcon size={20} /></button>
        </form>
      )}

      {step === "specialty" && (
        <ul className="choice-list">
          <li><button type="button" className="choice-card" aria-pressed={answers.specialty === ""} onClick={() => next({ specialty: "" })}><span className="choice-title">Any kind of doctor</span></button></li>
          {SPECIALTY_LIST.map((s) => (
            <li key={s.slug}>
              <button type="button" className="choice-card" aria-pressed={answers.specialty === s.label} onClick={() => next({ specialty: s.label })}>
                <span className="choice-title">{s.plain}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === "distance" && (
        <ul className="choice-list">
          <li><button type="button" className="choice-card" aria-pressed={answers.within === null} onClick={() => next({ within: null })}><span className="choice-title">Any distance</span></button></li>
          {DISTANCE_CHOICES.map((mi) => (
            <li key={mi}>
              <button type="button" className="choice-card" aria-pressed={answers.within === mi} onClick={() => next({ within: mi })}>
                <span className="choice-title">Within {mi} {mi === 1 ? "mile" : "miles"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {canSkip && (
        <div className="wizard-skips">
          <button type="button" className="btn-secondary" onClick={() => next(skipAnswer)}>Skip</button>
          <button type="button" className="link-button" onClick={() => submit(skipAnswer)}>Skip all and show results</button>
        </div>
      )}
    </div>
  );
}
