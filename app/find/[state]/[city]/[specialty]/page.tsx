import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CITIES, cityBySlug, cityPath } from "@/lib/cities";
import { SPECIALTY_LIST, specialtyBySlug } from "@/lib/specialties";
import { searchCitySpecialty, type Doctor } from "@/lib/npi";
import { computeCoverage } from "@/lib/insuranceCheck";
import { Breadcrumbs, DirectoryCta, DirectoryProviderCard, LinkGrid } from "@/components/Directory";

// Rendered on first visit, then cached for a day (provider records and CMS
// Medicare data change slowly).
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

const SHOWN = 50;
type PageProps = { params: Promise<{ state: string; city: string; specialty: string }> };

async function resolve(params: PageProps["params"]) {
  const p = await params;
  const city = cityBySlug(p.state, p.city);
  const specialty = specialtyBySlug(p.specialty);
  if (!city || !specialty) notFound();
  return { city, specialty };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, specialty } = await resolve(params);
  const title = `${specialty.plural} in ${city.name}, ${city.state} – Medicare status & contact info`;
  const description = `${specialty.plural} with a practice in ${city.name}, ${city.stateName}, from the official NPI Registry. See office addresses, phone numbers, and whether each accepts Original Medicare assignment.`;
  return {
    title: { absolute: `${title} | InsureBased` },
    description,
    ...(process.env.SITE_URL ? { alternates: { canonical: cityPath(city, specialty.slug) } } : {}),
    openGraph: { title, description },
  };
}

export default async function CitySpecialtyPage({ params }: PageProps) {
  const { city, specialty } = await resolve(params);
  let doctors: Doctor[] | null;
  let complete = true;
  try { ({ doctors, complete } = await searchCitySpecialty(city, specialty)); } catch { doctors = null; }
  const countText = (n: number) => complete ? String(n) : `More than ${n}`;
  const shown = (doctors ?? []).slice(0, SHOWN);
  const lookup = computeCoverage(shown.map(d => d.npi), { category: "medicare" });
  const lower = specialty.plural.toLowerCase();

  return (
    <main className="screen directory-screen">
      <Breadcrumbs items={[
        { href: "/", label: "Home" },
        { href: "/find", label: "Browse by city" },
        { href: cityPath(city), label: `${city.name}, ${city.state}` },
        { label: specialty.plural },
      ]} />
      <header className="directory-head">
        <h1>{specialty.plural} in {city.name}, {city.state}</h1>
        <p className="directory-intro">
          {doctors === null
            ? "Provider records are temporarily unavailable. Try again shortly."
            : doctors.length === 0
              ? `No ${lower} with a practice address in ${city.name} were found in the NPI Registry.`
              : `${countText(doctors.length)} ${doctors.length === 1 && complete ? specialty.label.toLowerCase() : lower} list a practice address in ${city.name} in the official NPI Registry. Each listing shows whether they accept Original Medicare assignment, from CMS data.`}
        </p>
      </header>

      <DirectoryCta city={city.name} />

      {shown.length > 0 && (
        <section className="directory-list" aria-label={`${specialty.plural} in ${city.name}`}>
          {shown.map(d => <DirectoryProviderCard key={d.npi} doctor={d} lookup={lookup} />)}
          {doctors && doctors.length > SHOWN && (
            <p className="directory-more">Showing {SHOWN} of {complete ? doctors.length : `${doctors.length}+`}, in registry order. <a href="/search">Search by ZIP code</a> to see providers closest to you.</p>
          )}
        </section>
      )}

      <LinkGrid
        title={`Other specialties in ${city.name}`}
        links={SPECIALTY_LIST.filter(s => s.slug !== specialty.slug).map(s => ({ href: cityPath(city, s.slug), label: s.plural }))}
      />
      <LinkGrid
        title={`${specialty.plural} in other ${city.stateName} cities`}
        links={CITIES.filter(c => c.state === city.state && c.slug !== city.slug).map(c => ({ href: cityPath(c, specialty.slug), label: `${c.name}, ${c.state}` }))}
      />
      <p className="disclaimer">Provider records come from the NPI Registry and can be out of date. Medicare status is for Original Medicare assignment only and does not confirm Medicare Advantage plans. Call the office to confirm your plan and that they are taking new patients.</p>
    </main>
  );
}
