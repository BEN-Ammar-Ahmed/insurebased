import { NextRequest, NextResponse } from "next/server";
import { storedSearch, storedCoordinates, storedZip, providerPool } from "@/lib/providerStore";
import { searchNpi, type Doctor } from "@/lib/npi";
import { zipToLatLng, latLngToZip, type LatLng } from "@/lib/geo";
import { geocodeProviderLocations } from "@/lib/providerLocations";
import { parseInsuranceQuery } from "@/lib/insuranceCheck";
import { isValidZip } from "@/lib/validation";
import { rateLimitResponse } from "@/lib/rateLimit";

// Returns providers with real office pins as fast as possible. Insurance
// coverage is NOT computed here — the client fetches it from
// /api/doctors/coverage so a slow government source never blocks the list.
export async function GET(req: NextRequest) {
  const limited = await rateLimitResponse(req, "search");
  if (limited) return limited;

  const sp = req.nextUrl.searchParams;
  const zip = sp.get("zip") ?? "";
  const specialty = sp.get("specialty") ?? "";
  const name = sp.get("name") ?? "";
  const state = sp.get("state") ?? "";
  const skip = Math.max(0, parseInt(sp.get("skip") ?? "0", 10) || 0);
  const latParam = sp.get("lat");
  const lngParam = sp.get("lng");
  const area =
    latParam !== null && lngParam !== null
      ? { lat: parseFloat(latParam), lng: parseFloat(lngParam) }
      : null;

  if (name.length > 100 || specialty.length > 100 || (state && !/^[A-Z]{2}$/.test(state)) || skip > 1000) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  const insuranceQuery = parseInsuranceQuery(sp);
  if ("error" in insuranceQuery) {
    return NextResponse.json({ error: insuranceQuery.error }, { status: 400 });
  }

  if (area && (!Number.isFinite(area.lat) || !Number.isFinite(area.lng) || Math.abs(area.lat) > 90 || Math.abs(area.lng) > 180)) {
    return NextResponse.json({ error: "invalid_area" }, { status: 400 });
  }
  if (zip && !isValidZip(zip)) {
    return NextResponse.json({ error: "invalid_zip" }, { status: 400 });
  }
  if (!zip && !name && !area) {
    return NextResponse.json({ error: "missing_query" }, { status: 400 });
  }

  let doctors: Doctor[];
  let hasMore = false;
  let center: LatLng | null = null;
  let resolvedZip: string | null = zip || null;
  try {
    if (name) {
      const parts = name.trim().split(/\s+/);
      const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const firstName = parts.length > 1 ? parts[0] : "";
      const stored = await storedSearch({ name: name.trim(), state, skip });
      ({ doctors, hasMore } = stored ?? await searchNpi({
        lastName: `${lastName}*`,
        ...(firstName ? { firstName: `${firstName}*` } : {}),
        ...(state ? { state } : {}),
        skip,
      }));
    } else if (area) {
      resolvedZip = await latLngToZip(area.lat, area.lng);
      if (!resolvedZip) {
        return NextResponse.json({ error: "area_unresolved" }, { status: 502 });
      }
      center = area;
      const stored = await storedSearch({ zip: resolvedZip, specialty, skip });
      ({ doctors, hasMore } = stored ?? await searchNpi({
        zip: resolvedZip,
        ...(specialty ? { specialty } : {}),
        skip,
      }));
    } else {
      const [searchResult, geo] = await Promise.all([
        storedSearch({ zip, specialty, skip }).then(stored => stored ?? searchNpi({ zip, ...(specialty ? { specialty } : {}), skip })),
        storedZip(zip).then(point => point ?? zipToLatLng(zip)),
      ]);
      doctors = searchResult.doctors;
      hasMore = searchResult.hasMore;
      center = geo;
    }
  } catch {
    return NextResponse.json({ error: "npi_unavailable" }, { status: 502 });
  }

  if (providerPool()) {
    try { doctors = await storedCoordinates(doctors, center); } catch { /* List stays usable without stored pins. */ }
  }
  // Anything without a stored pin is matched live against the Census geocoder.
  doctors = await geocodeProviderLocations(doctors, center);

  // A name search has no ZIP center; center the map on the matches instead.
  if (!center) {
    const pinned = doctors.find(d => d.lat !== null && d.lng !== null);
    if (pinned) center = { lat: pinned.lat!, lng: pinned.lng! };
  }

  if (!name) {
    doctors.sort((a, b) => (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity));
  }

  return NextResponse.json({ center, zip: resolvedZip, doctors, hasMore, skip, nextSkip: skip + 50 });
}
