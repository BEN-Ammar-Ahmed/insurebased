"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LOCATION_MESSAGES, parseLocationInput, type Place } from "@/lib/locationInput";
import { INSURANCE_CHOICES, panelDestination, type Category } from "@/lib/searchFlow";
import LocationField, { CURRENT_LOCATION_TEXT } from "./LocationField";

export type PanelInitial = { location?: string; place?: Place; category?: Category | null };

// ZIP codes are used directly; street addresses are looked up on our server.
export async function resolvePlaceFromText(text: string): Promise<{ place?: Place; error?: string }> {
  const input = parseLocationInput(text);
  if (input.kind === "zip") return { place: { zip: input.zip } };
  if (input.kind === "empty") return { error: LOCATION_MESSAGES.empty };
  if (input.kind === "invalid") return { error: input.message };
  try {
    // POST keeps typed home addresses out of URLs and request logs.
    const response = await fetch("/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: input.address }),
      signal: AbortSignal.timeout(12000),
    });
    if (response.status === 404) return { error: LOCATION_MESSAGES.notFound };
    if (!response.ok) throw new Error(String(response.status));
    const place = await response.json();
    if (typeof place.zip === "string") return { place: { zip: place.zip } };
    if (typeof place.lat === "string" && typeof place.lng === "string") return { place: { lat: place.lat, lng: place.lng } };
    throw new Error("bad_response");
  } catch {
    return { error: "We couldn't check that address right now. Try a ZIP code." };
  }
}

export default function SearchPanel({ initial = {}, onClose, titleId }: { initial?: PanelInitial; onClose?: () => void; titleId: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial.location ?? (initial.place && !("zip" in initial.place) ? CURRENT_LOCATION_TEXT : ""));
  const [gpsPlace, setGpsPlace] = useState<Place | null>(initial.place && !("zip" in initial.place) ? initial.place : null);
  const [category, setCategory] = useState<Category | null>(initial.category ?? null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(more: boolean) {
    setError("");
    let place: Place | null = gpsPlace && text === CURRENT_LOCATION_TEXT ? gpsPlace : null;
    if (!place) {
      setBusy(true);
      const result = await resolvePlaceFromText(text);
      setBusy(false);
      if (!result.place) { setError(result.error ?? LOCATION_MESSAGES.empty); return; }
      place = result.place;
    }
    router.push(panelDestination({ place, category, more }));
  }

  return (
    <form className="search-panel" noValidate aria-labelledby={titleId}
      onSubmit={(e: FormEvent) => { e.preventDefault(); void go(false); }}
      onKeyDown={(e) => { if (e.key === "Escape" && onClose) { e.stopPropagation(); onClose(); } }}>
      <div className="search-panel-top">
        <h2 id={titleId} className="search-panel-title">Where are you looking?</h2>
        {onClose && <button type="button" className="link-button" onClick={onClose}>Close</button>}
      </div>
      <LocationField id={`${titleId}-location`} value={text} autoFocus error={error} onError={setError}
        onChange={(v) => { setText(v); if (gpsPlace) setGpsPlace(null); }}
        onLocated={(place) => { setGpsPlace(place); setText(CURRENT_LOCATION_TEXT); }} />
      <fieldset className="insurance-choices">
        <legend className="lbl">Your insurance</legend>
        {INSURANCE_CHOICES.map((choice) => (
          <label key={choice.value} className="insurance-choice">
            <input type="radio" name={`${titleId}-insurance`} value={choice.value} checked={category === choice.value} onChange={() => setCategory(choice.value)} />
            <span>
              <span className="insurance-choice-title">{choice.title}</span>
              <span className="insurance-choice-detail">{choice.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="search-panel-actions">
        <button type="submit" className="btn-primary btn-pill" disabled={busy}>{busy ? "Finding that address…" : "Search"}</button>
        <button type="button" className="link-button" onClick={() => void go(true)} disabled={busy}>More options ›</button>
      </div>
      <Link className="text-action-link" href="/search?by=name">Search by a doctor&apos;s name instead</Link>
    </form>
  );
}
