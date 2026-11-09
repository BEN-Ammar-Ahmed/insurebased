import { addressesToLatLng, milesBetween, type LatLng } from "./geo";
import type { Doctor } from "./npi";

export const MAX_SERVER_PROVIDER_GEOCODES = 60;

export function providerFullAddress(
  doctor: Pick<Doctor, "address1" | "city" | "state" | "zip">
): string {
  const cityStateZip = [doctor.city, [doctor.state, doctor.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [doctor.address1, cityStateZip]
    .filter(Boolean)
    .join(", ");
}

// Places every provider's real practice address on the map with one batch
// geocoder request. Mailing-only addresses and non-matches get no pin.
export async function geocodeProviderLocations<T extends Doctor>(
  doctors: T[],
  center: LatLng | null,
  limit = MAX_SERVER_PROVIDER_GEOCODES
): Promise<T[]> {
  const candidates = doctors
    .slice(0, limit)
    .filter(d => d.lat === null && d.addressKind !== "mailing" && d.address1);
  if (!candidates.length) return doctors;
  const points = await addressesToLatLng(
    // Census matches "Blvd South" but often not "Blvd. South".
    candidates.map(d => ({ id: d.npi, street: d.address1.replace(/\./g, ""), city: d.city, state: d.state, zip: d.zip }))
  );
  return doctors.map((doctor) => {
    const coords = doctor.lat === null ? points.get(doctor.npi) : undefined;
    if (!coords) return doctor;
    return {
      ...doctor,
      lat: coords.lat,
      lng: coords.lng,
      distanceMi: center ? milesBetween(center, coords) : null,
      locationApproximate: false,
      locationPrecision: "address" as const,
      locationSource: "census" as const,
    };
  });
}
