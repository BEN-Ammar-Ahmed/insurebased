import { NextRequest, NextResponse } from "next/server";
import { addressToLatLng } from "@/lib/geo";
import { LOCATION_MESSAGES, parseLocationInput, resolveLocation } from "@/lib/locationInput";
import { rateLimitResponse } from "@/lib/rateLimit";

// Turns what someone typed in "Where are you looking?" into a ZIP or rounded
// coordinates. Addresses go through the Census geocoder; if it has no match
// we say so instead of guessing.
export async function GET(req: NextRequest) {
  const limited = await rateLimitResponse(req, "location");
  if (limited) return limited;

  const text = req.nextUrl.searchParams.get("q") ?? "";
  const input = parseLocationInput(text);
  if (input.kind === "empty" || input.kind === "invalid") {
    const message = input.kind === "empty" ? LOCATION_MESSAGES.empty : input.message;
    return NextResponse.json({ error: "invalid_location", message }, { status: 400 });
  }

  const result = await resolveLocation(text, addressToLatLng);
  if (result.kind === "error") {
    return NextResponse.json({ error: "address_not_found", message: result.message }, { status: 404 });
  }
  return NextResponse.json(result.place);
}
