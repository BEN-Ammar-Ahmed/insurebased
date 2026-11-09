"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Doctor } from "@/lib/npi";
import type { LatLng } from "@/lib/geo";
import { coverageMarkerColor, type CoverageDisplay } from "@/lib/coverage";
import { ChevronRightIcon, RefreshIcon, XIcon } from "./Icons";
import { CoverageBadge } from "./CoverageBadge";
import { PrimaryDirectionsLink } from "./DirectionsLinks";

type MapDoctor = Doctor & { coverage?: CoverageDisplay };
type Group = { key: string; lat: number; lng: number; doctors: MapDoctor[] };

// Standard OpenStreetMap street tiles (free, no key). globals.css softens
// their colors so provider pins stand out.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function groupColor(group: Group): string {
  const statuses = group.doctors.map(d => d.coverage?.status);
  if (statuses.includes("covered")) return coverageMarkerColor("covered");
  if (statuses.length && statuses.every(s => s === "not_covered")) return coverageMarkerColor("not_covered");
  return coverageMarkerColor(undefined);
}

// A teardrop pin drawn so its tip sits exactly on the office's coordinates.
const PIN_PATH = "M14 0C6.3 0 0 6.1 0 13.7 0 23.6 14 36 14 36s14-12.4 14-22.3C28 6.1 21.7 0 14 0z";
function pinIcon(color: string, label: string, selected: boolean) {
  const scale = selected ? 1.25 : 1;
  const w = Math.round(28 * scale), h = Math.round(36 * scale);
  return L.divIcon({
    className: "map-pin-wrap",
    html: `<span class="map-pin${selected ? " is-selected" : ""}" style="--pin-color:${color};width:${w}px;height:${h}px" aria-hidden="true"><svg viewBox="0 0 28 36" width="${w}" height="${h}"><path d="${PIN_PATH}"/></svg><span class="map-pin-label">${label}</span></span>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
  });
}

// Where distances are measured from: the ZIP's center or the searched point.
const centerIcon = L.divIcon({ className: "map-center-wrap", html: '<span class="map-center" aria-hidden="true"></span>', iconSize: [20, 20], iconAnchor: [10, 10] });

function groupLabel(group: Group, numbers?: Map<string, number>): string {
  const nums = group.doctors.map(d => numbers?.get(d.npi)).filter((n): n is number => n !== undefined);
  if (!nums.length) return group.doctors.length > 1 ? String(Math.min(group.doctors.length, 99)) : "";
  const first = Math.min(...nums);
  return group.doctors.length > 1 ? `${first}+` : String(first);
}

export default function ResultsMap({
  center,
  centerLabel,
  doctors,
  numbers,
  activeNpi,
  query,
  onSearchArea,
}: {
  center: LatLng;
  centerLabel?: string;
  doctors: MapDoctor[];
  numbers?: Map<string, number>;
  activeNpi?: string | null;
  query: string;
  refiningLocations?: boolean;
  onSearchArea?: (lat: number, lng: number) => void;
}) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const pannedRef = useRef(false);
  const fittedGroups = useRef<Group[] | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [panned, setPanned] = useState(false);
  const [refit, setRefit] = useState(0);
  // True while the map moves on its own (fitting pins, resizing) so only a
  // person dragging or zooming shows "Search this area".
  const programmaticMove = useRef(true);

  const groups = useMemo(() => {
    const byKey = new Map<string, Group>();
    for (const d of doctors) {
      if (d.lat === null || d.lng === null) continue;
      const key = d.lat.toFixed(5) + "," + d.lng.toFixed(5);
      const group = byKey.get(key) ?? { key, lat: d.lat, lng: d.lng, doctors: [] };
      group.doctors.push(d);
      byKey.set(key, group);
    }
    return [...byKey.values()];
  }, [doctors]);
  const selected = groups.find(g => g.key === selectedKey) ?? null;

  useEffect(() => {
    if (!mapDiv.current) return;
    setPanned(false);
    pannedRef.current = false;
    fittedGroups.current = null;
    setSelectedKey(null);
    const map = L.map(mapDiv.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([center.lat, center.lng], 14);
    mapRef.current = map;
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    programmaticMove.current = true;
    map.once("moveend", () => { programmaticMove.current = false; });
    const handleMoveStart = () => {
      if (!programmaticMove.current) {
        pannedRef.current = true;
        setPanned(true);
      }
    };
    map.on("movestart", handleMoveStart);
    map.on("click", () => setSelectedKey(null));

    // The map can be created while hidden (List view on phones). Re-measure
    // whenever its box changes size so tiles fill it once it is shown.
    let wasHidden = mapDiv.current.offsetWidth === 0;
    const observer = new ResizeObserver(() => {
      const el = mapDiv.current;
      if (!el || !el.offsetWidth) { wasHidden = true; return; }
      programmaticMove.current = true;
      map.invalidateSize();
      programmaticMove.current = false;
      if (wasHidden) {
        wasHidden = false;
        fittedGroups.current = null;
        setRefit(n => n + 1);
      }
    });
    observer.observe(mapDiv.current);

    return () => {
      observer.disconnect();
      map.off();
      markerLayerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerLayerRef.current?.remove();
    const layer = L.layerGroup().addTo(map);
    markerLayerRef.current = layer;

    if (centerLabel) {
      L.marker([center.lat, center.lng], { icon: centerIcon, title: centerLabel, alt: centerLabel, interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(layer);
    }
    const markers = groups.map((group) => {
      const isSelected = group.key === selectedKey || group.doctors.some(d => d.npi === activeNpi);
      const first = group.doctors[0];
      const marker = L.marker([group.lat, group.lng], {
        title: group.doctors.length > 1 ? `${group.doctors.length} providers at ${first.address1}` : first.name,
        alt: first.name,
        icon: pinIcon(groupColor(group), groupLabel(group, numbers), isSelected),
        keyboard: true,
        zIndexOffset: isSelected ? 1000 : 0,
      }).addTo(layer);
      marker.on("click", (e) => { L.DomEvent.stopPropagation(e); setSelectedKey(group.key); });
      return marker;
    });

    // Only re-frame the map when the set of providers changes, not when a pin
    // is selected or closed.
    if (markers.length && !pannedRef.current && fittedGroups.current !== groups) {
      fittedGroups.current = groups;
      const bounds = L.featureGroup(markers).getBounds();
      if (centerLabel) bounds.extend([center.lat, center.lng]);
      programmaticMove.current = true;
      map.fitBounds(bounds.pad(0.2), { maxZoom: 16, animate: false });
      programmaticMove.current = false;
    }
  }, [groups, selectedKey, refit, numbers, activeNpi, center, centerLabel]);

  function handleSearchArea() {
    if (!mapRef.current || !onSearchArea) return;
    const c = mapRef.current.getCenter();
    setPanned(false);
    onSearchArea(c.lat, c.lng);
  }

  return (
    <div className="results-map-shell">
      <div ref={mapDiv} className="results-map-canvas" />
      {centerLabel && <p className="map-legend"><span className="map-center" aria-hidden="true" />{centerLabel}. Distances are measured from here.</p>}
      {panned && onSearchArea && (
        <button type="button" className="map-area-button" onClick={handleSearchArea}>
          <RefreshIcon size={14} />
          Search this area
        </button>
      )}
      {selected && (
        <div className="map-selected-provider" role="region" aria-label={selected.doctors.length > 1 ? `${selected.doctors.length} providers at ${selected.doctors[0].address1}` : `Selected provider: ${selected.doctors[0].name}`}>
          <button type="button" className="map-selected-close" aria-label="Close" onClick={() => setSelectedKey(null)}><XIcon size={16} /></button>
          {selected.doctors.length > 1 && <p className="map-selected-heading">{selected.doctors.length} providers at {selected.doctors[0].address1}</p>}
          <ul className="map-selected-list">
            {selected.doctors.slice(0, 6).map(d => (
              <li key={d.npi}>
                <p className="doctor-card-name"><Link href={`/doctor/${d.npi}${query}`}>{d.name}</Link></p>
                <p className="doctor-card-meta">{numbers?.get(d.npi) !== undefined && `#${numbers.get(d.npi)} · `}{d.specialty}{d.distanceMi !== null && ` · ${d.distanceMi} mi`}</p>
                <p className="doctor-card-meta">{[d.placeName, d.address1].filter(Boolean).join(", ")}</p>
                {d.coverage && <CoverageBadge coverage={d.coverage} />}
                {selected.doctors.length === 1 && (
                  <div className="map-selected-actions">
                    <PrimaryDirectionsLink doctor={d} />
                    <Link href={`/doctor/${d.npi}${query}`}>View profile <ChevronRightIcon size={14} /></Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {selected.doctors.length > 6 && <p className="doctor-card-meta">and {selected.doctors.length - 6} more in the list</p>}
        </div>
      )}
    </div>
  );
}
