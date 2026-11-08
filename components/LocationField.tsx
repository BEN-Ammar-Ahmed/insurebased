"use client";
import { useState } from "react";
import { roundCoord, type Place } from "@/lib/locationInput";
import { LocateIcon, MapPinIcon } from "./Icons";

export const CURRENT_LOCATION_TEXT = "Current location";

// One box for a ZIP code or street address, plus a button that asks the
// browser for the visitor's location.
export default function LocationField({ id, value, onChange, error, onError, onLocated, autoFocus }: {
  id: string;
  value: string;
  onChange(v: string): void;
  error: string;
  onError(message: string): void;
  onLocated(place: Place): void;
  autoFocus?: boolean;
}) {
  const [locating, setLocating] = useState(false);
  function locate() {
    if (!navigator.geolocation) { onError("Location isn't available on this device. Enter a ZIP code instead."); return; }
    onError(""); setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setLocating(false); onLocated({ lat: roundCoord(coords.latitude), lng: roundCoord(coords.longitude) }); },
      () => { setLocating(false); onError("Location was blocked or timed out. Enter a ZIP code instead."); },
      { timeout: 8000, maximumAge: 300000 }
    );
  }
  const errorId = `${id}-error`;
  return (
    <div className="location-field">
      <label className="lbl" htmlFor={id}>ZIP code or street address</label>
      <div className="fld fld-large">
        <MapPinIcon size={20} className="fld-icon" />
        <input id={id} name="location" autoComplete="street-address" placeholder="e.g. 60614" value={value} autoFocus={autoFocus}
          onChange={(e) => { onChange(e.target.value); onError(""); }}
          aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />
      </div>
      {error && <p id={errorId} className="err-text" role="alert">{error}</p>}
      <button type="button" className="link-button locate-button" onClick={locate} disabled={locating} aria-busy={locating}>
        <LocateIcon size={18} />{locating ? "Finding your location…" : "Use my current location"}
      </button>
    </div>
  );
}
