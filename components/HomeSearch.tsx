"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LocateIcon, MapPinIcon } from "./Icons";

// One field to start. Insurance and specialty are asked one at a time on the
// next screen so the first step never feels like a long form.
export default function HomeSearch() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [zip, setZip] = useState("");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{5}$/.test(zip)) { setError("Enter a five-digit US ZIP code."); return; }
    setError("");
    router.push("/search?zip=" + zip);
  }
  function locate() {
    if (!navigator.geolocation) { setError("Location is unavailable. Enter a ZIP code instead."); return; }
    setError(""); setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setLocating(false); router.push(`/search?lat=${coords.latitude.toFixed(5)}&lng=${coords.longitude.toFixed(5)}`); },
      () => { setLocating(false); setError("Location was blocked or timed out. Enter a ZIP code instead."); },
      { timeout: 8000, maximumAge: 300000 }
    );
  }
  return <section className="home-search-card" aria-labelledby="home-search-title">
    <div className="home-search-header"><h2 id="home-search-title">Find doctors near you</h2><p className="home-search-helper">Start with your ZIP code. Next, we&apos;ll ask about your insurance.</p></div>
    <form className="home-quick-form" data-ready={ready} onSubmit={submit} noValidate>
      <div><label className="lbl" htmlFor="home-zip">ZIP code</label><div className="fld fld-large"><MapPinIcon size={20} className="fld-icon" /><input id="home-zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="e.g. 60614" value={zip} onChange={e => { setZip(e.target.value.replace(/\D/g, "")); setError(""); }} aria-invalid={!!error} aria-describedby={error ? "home-search-error" : undefined} /></div></div>
      <button type="submit" className="btn-primary">Find doctors</button>
    </form>
    {error && <p id="home-search-error" className="err-text" role="alert">{error}</p>}
    <div className="home-search-secondary">
      <button className="home-locate-button" type="button" disabled={locating} aria-busy={locating} onClick={locate}><LocateIcon size={16} />{locating ? "Finding your location…" : "Use my location"}</button>
      <Link className="home-insurance-link" href="/search?by=name">Search by provider name</Link>
    </div>
  </section>;
}
