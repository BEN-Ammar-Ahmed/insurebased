// The 50 most populous US cities (Census estimates). Directory pages are
// generated for these; `registryCity` is how the NPI registry spells the
// city on practice addresses.
export type City = { slug: string; name: string; state: string; stateName: string; registryCity: string };

const RAW: [string, string, string][] = [
  ["New York", "NY", "New York"], ["Los Angeles", "CA", "California"], ["Chicago", "IL", "Illinois"],
  ["Houston", "TX", "Texas"], ["Phoenix", "AZ", "Arizona"], ["Philadelphia", "PA", "Pennsylvania"],
  ["San Antonio", "TX", "Texas"], ["San Diego", "CA", "California"], ["Dallas", "TX", "Texas"],
  ["Jacksonville", "FL", "Florida"], ["Austin", "TX", "Texas"], ["Fort Worth", "TX", "Texas"],
  ["San Jose", "CA", "California"], ["Columbus", "OH", "Ohio"], ["Charlotte", "NC", "North Carolina"],
  ["Indianapolis", "IN", "Indiana"], ["San Francisco", "CA", "California"], ["Seattle", "WA", "Washington"],
  ["Denver", "CO", "Colorado"], ["Oklahoma City", "OK", "Oklahoma"], ["Nashville", "TN", "Tennessee"],
  ["Washington", "DC", "District of Columbia"], ["El Paso", "TX", "Texas"], ["Las Vegas", "NV", "Nevada"],
  ["Boston", "MA", "Massachusetts"], ["Detroit", "MI", "Michigan"], ["Portland", "OR", "Oregon"],
  ["Louisville", "KY", "Kentucky"], ["Memphis", "TN", "Tennessee"], ["Baltimore", "MD", "Maryland"],
  ["Milwaukee", "WI", "Wisconsin"], ["Albuquerque", "NM", "New Mexico"], ["Tucson", "AZ", "Arizona"],
  ["Fresno", "CA", "California"], ["Sacramento", "CA", "California"], ["Mesa", "AZ", "Arizona"],
  ["Kansas City", "MO", "Missouri"], ["Atlanta", "GA", "Georgia"], ["Omaha", "NE", "Nebraska"],
  ["Colorado Springs", "CO", "Colorado"], ["Raleigh", "NC", "North Carolina"], ["Long Beach", "CA", "California"],
  ["Virginia Beach", "VA", "Virginia"], ["Miami", "FL", "Florida"], ["Oakland", "CA", "California"],
  ["Minneapolis", "MN", "Minnesota"], ["Tulsa", "OK", "Oklahoma"], ["Bakersfield", "CA", "California"],
  ["Tampa", "FL", "Florida"], ["Arlington", "TX", "Texas"],
];

export const CITIES: City[] = RAW.map(([name, state, stateName]) => ({
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  state,
  stateName,
  registryCity: name.toUpperCase(),
}));

export function cityBySlug(state: string, slug: string): City | undefined {
  return CITIES.find(c => c.state.toLowerCase() === state.toLowerCase() && c.slug === slug);
}

export function cityForAddress(city: string, state: string): City | undefined {
  return CITIES.find(c => c.registryCity === city.trim().toUpperCase() && c.state === state.trim().toUpperCase());
}

export function cityPath(city: City, specialtySlug?: string): string {
  return `/find/${city.state.toLowerCase()}/${city.slug}${specialtySlug ? "/" + specialtySlug : ""}`;
}
