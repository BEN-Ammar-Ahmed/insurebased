import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CITIES, cityBySlug, cityPath } from "@/lib/cities";
import { SPECIALTY_LIST } from "@/lib/specialties";
import { Breadcrumbs, DirectoryCta, LinkGrid } from "@/components/Directory";

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

type PageProps = { params: Promise<{ state: string; city: string }> };

async function resolve(params: PageProps["params"]) {
  const p = await params;
  const city = cityBySlug(p.state, p.city);
  if (!city) notFound();
  return city;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const city = await resolve(params);
  const title = `Find doctors in ${city.name}, ${city.state}`;
  const description = `Browse doctors, dentists and therapists in ${city.name}, ${city.stateName} by specialty, with Original Medicare status and office contact details from official public records.`;
  return {
    title,
    description,
    ...(process.env.SITE_URL ? { alternates: { canonical: cityPath(city) } } : {}),
    openGraph: { title, description },
  };
}

export default async function CityPage({ params }: PageProps) {
  const city = await resolve(params);
  return (
    <main className="screen directory-screen">
      <Breadcrumbs items={[
        { href: "/", label: "Home" },
        { href: "/find", label: "Browse by city" },
        { label: `${city.name}, ${city.state}` },
      ]} />
      <header className="directory-head">
        <h1>Find doctors in {city.name}, {city.state}</h1>
        <p className="directory-intro">Choose a specialty to see providers with a practice address in {city.name}, from the official NPI Registry, and whether each accepts Original Medicare assignment.</p>
      </header>
      <LinkGrid title="Specialties" links={SPECIALTY_LIST.map(s => ({ href: cityPath(city, s.slug), label: s.plural }))} />
      <DirectoryCta city={city.name} />
      <LinkGrid
        title={`Other cities in ${city.stateName}`}
        links={CITIES.filter(c => c.state === city.state && c.slug !== city.slug).map(c => ({ href: cityPath(c), label: `${c.name}, ${c.state}` }))}
      />
    </main>
  );
}
