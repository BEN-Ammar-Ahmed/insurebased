import { NextRequest, NextResponse } from "next/server";
import { storedProvider, storedCoordinates } from "@/lib/providerStore";
import { fetchNpiByNumber } from "@/lib/npi";
import { geocodeProviderLocations } from "@/lib/providerLocations";
import { isValidNpi } from "@/lib/validation";
import { rateLimitResponse } from "@/lib/rateLimit";

// Returns one provider's public record and office pin. Coverage is loaded
// separately from /api/doctors/coverage so the profile opens immediately.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ npi: string }> }
) {
  const limited = await rateLimitResponse(req, "detail");
  if (limited) return limited;

  const { npi } = await params;
  if (!isValidNpi(npi)) {
    return NextResponse.json({ error: "invalid_npi" }, { status: 400 });
  }

  try {
    const stored = await storedProvider(npi);
    let doctor = stored === undefined ? await fetchNpiByNumber(npi) : stored;
    if (!doctor) {
      return NextResponse.json({ doctor: null }, { status: 404 });
    }
    if (process.env.DATABASE_URL) [doctor] = await storedCoordinates([doctor], null);
    [doctor] = await geocodeProviderLocations([doctor], null);
    return NextResponse.json({ doctor });
  } catch {
    return NextResponse.json({ error: "npi_unavailable" }, { status: 502 });
  }
}
