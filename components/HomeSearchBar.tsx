"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LOCATION_MESSAGES, roundCoord, type Place } from "@/lib/locationInput";
import { panelDestination, placeParams, resultsHref } from "@/lib/searchFlow";
import { parseQuickSearch, type QuickSearch } from "@/lib/quickSearch";
import { resolvePlaceFromText } from "./SearchPanel";
import { ChevronRightIcon, LocateIcon, SearchIcon } from "./Icons";

function destination(place: Place | null, parsed: QuickSearch): string {
  if (!place) return `/search?category=${parsed.category}`;
  if (parsed.category === null) return `/search?${placeParams(place)}`;
  if (parsed.category === "other") return resultsHref({ place, category: "other", insurerName: parsed.insurerName });
  return panelDestination({ place, category: parsed.category, more: false });
}

// A round search icon that grows into a search box on hover or focus. People
// type a ZIP code or address right here (optionally with their insurance,
// e.g. "33965 medicare"). Anything not typed is asked on the question page.
// Without JavaScript the form still goes to the question page.
export default function HomeSearchBar({ titleId = "home-search" }: { titleId?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "address" | "gps">("");
  const inputId = `${titleId}-input`;
  const errorId = `${titleId}-error`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = parseQuickSearch(text);
    if (!parsed.location) {
      if (parsed.category) { router.push(destination(null, parsed)); return; }
      setError(LOCATION_MESSAGES.empty);
      input.current?.focus();
      return;
    }
    setBusy("address");
    const result = await resolvePlaceFromText(parsed.location);
    setBusy("");
    if (!result.place) { setError(result.error ?? LOCATION_MESSAGES.empty); input.current?.focus(); return; }
    router.push(destination(result.place, parsed));
  }

  function locate() {
    if (!navigator.geolocation) { setError("Location isn't available on this device. Enter a ZIP code instead."); return; }
    setError(""); setBusy("gps");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setBusy("");
        router.push(destination({ lat: roundCoord(coords.latitude), lng: roundCoord(coords.longitude) }, parseQuickSearch(text)));
      },
      () => { setBusy(""); setError("Location was blocked or timed out. Enter a ZIP code instead."); },
      { timeout: 8000, maximumAge: 300000 }
    );
  }

  return (
    <div className="home-search">
      <form className="search-bar" role="search" action="/search" noValidate onSubmit={(e) => void submit(e)} data-filled={text ? "true" : "false"}
        onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); input.current?.focus(); } }}>
        <label htmlFor={inputId} className="search-bar-icon">
          <SearchIcon size={26} />
          <span className="sr-only">Search by ZIP code, address, or insurance</span>
        </label>
        <input ref={input} id={inputId} name="q" type="text" inputMode="text" enterKeyHint="search" autoComplete="off" spellCheck={false}
          className="search-bar-input" placeholder="ZIP code, address, or insurance" value={text}
          onChange={(e) => { setText(e.target.value); setError(""); }}
          aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />
        <button type="button" className="search-bar-action" onClick={locate} disabled={!!busy} aria-label="Use my current location" title="Use my current location">
          <LocateIcon size={20} />
        </button>
        <button type="submit" className="search-bar-action search-bar-go" disabled={!!busy} aria-label="Search">
          <ChevronRightIcon size={22} />
        </button>
      </form>
      {busy && <p className="search-bar-status" role="status">{busy === "gps" ? "Finding your location…" : "Finding that place…"}</p>}
      {error && <p id={errorId} className="err-text" role="alert">{error}</p>}
    </div>
  );
}
