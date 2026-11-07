import type { Metadata } from "next";
import Link from "next/link";
import { CITIES, cityPath } from "@/lib/cities";
import { Breadcrumbs, DirectoryCta } from "@/components/Directory";

export const metadata: Metadata = {
  title: "Browse doctors by city",
  description: "Find doctors, dentists and therapists in the 50 largest US cities by specialty, with Original Medicare status from official public records.",
  ...(process.env.SITE_URL ? { alternates: { canonical: "/find" } } : {}),
};

export default function FindIndexPage() {
  const byState = new Map<string, typeof CITIES>();
  for (const city of CITIES) byState.set(city.stateName, [...(byState.get(city.stateName) ?? []), city]);
  const states = [...byState.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <main className="screen directory-screen">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Browse by city" }]} />
      <header className="directory-head">
        <h1>Browse doctors by city</h1>
        <p className="directory-intro">Provider listings for the 50 largest US cities. For anywhere else, search by ZIP code.</p>
      </header>
      <DirectoryCta />
      <div className="state-list">
        {states.map(([stateName, cities]) => (
          <section key={stateName} className="state-group" aria-label={stateName}>
            <h2>{stateName}</h2>
            <ul>
              {cities.sort((a, b) => a.name.localeCompare(b.name)).map(c => <li key={c.slug}><Link href={cityPath(c)}>{c.name}</Link></li>)}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
