// Reads what someone typed in the "Where are you looking?" box. A ZIP code is
// used as-is; a street address is geocoded server-side (Census). Anything
// else gets a plain message — never a guessed location.

export type Place = { zip: string } | { lat: string; lng: string };

export type LocationInput =
  | { kind: "zip"; zip: string }
  | { kind: "address"; address: string }
  | { kind: "empty" }
  | { kind: "invalid"; message: string };

export type ResolvedLocation = { kind: "place"; place: Place } | { kind: "error"; message: string };

export const LOCATION_MESSAGES = {
  empty: "Enter a ZIP code or address, or use your current location.",
  invalid: "Enter a 5-digit ZIP code, or a street address with city and state.",
  notFound: "We couldn't find that address. Try a ZIP code.",
} as const;

export function parseLocationInput(text: string): LocationInput {
  const value = text.trim();
  if (!value) return { kind: "empty" };
  const zip = /^(\d{5})(?:-\d{4})?$/.exec(value);
  if (zip) return { kind: "zip", zip: zip[1] };
  // A street address needs a house number and a street name.
  const looksLikeAddress = value.length >= 5 && value.length <= 200 && /\d/.test(value) && /[a-z]/i.test(value);
  if (looksLikeAddress) return { kind: "address", address: value };
  return { kind: "invalid", message: LOCATION_MESSAGES.invalid };
}

// Coordinates go into shareable URLs, so keep them to about 100 m rather than
// pinpointing someone's home.
export function roundCoord(n: number): string {
  return n.toFixed(3);
}

export async function resolveLocation(
  text: string,
  geocode: (address: string) => Promise<{ lat: number; lng: number } | null>
): Promise<ResolvedLocation> {
  const input = parseLocationInput(text);
  if (input.kind === "zip") return { kind: "place", place: { zip: input.zip } };
  if (input.kind === "empty") return { kind: "error", message: LOCATION_MESSAGES.empty };
  if (input.kind === "invalid") return { kind: "error", message: input.message };
  const coords = await geocode(input.address);
  if (!coords) return { kind: "error", message: LOCATION_MESSAGES.notFound };
  return { kind: "place", place: { lat: roundCoord(coords.lat), lng: roundCoord(coords.lng) } };
}
