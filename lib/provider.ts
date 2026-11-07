import { cache } from "react";
import { storedProvider, storedCoordinates } from "./providerStore";
import { fetchNpiByNumber, type Doctor } from "./npi";
import { geocodeProviderLocations } from "./providerLocations";

// One provider's public record plus its office pin. Used by the provider API
// route and the server-rendered profile page. `cache` dedupes the lookup
// between generateMetadata and the page within one request.
export const getProvider = cache(async (npi: string): Promise<Doctor | null> => {
  const stored = await storedProvider(npi);
  let doctor = stored === undefined ? await fetchNpiByNumber(npi) : stored;
  if (!doctor) return null;
  if (process.env.DATABASE_URL) [doctor] = await storedCoordinates([doctor], null);
  [doctor] = await geocodeProviderLocations([doctor], null);
  return doctor;
});
