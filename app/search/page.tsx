import type { Metadata } from "next";
import SearchForm, { type SearchStart } from "@/components/SearchForm";
import { CATEGORIES, type Category } from "@/lib/searchFlow";

export const metadata: Metadata = { title: "Find Doctors", ...(process.env.SITE_URL ? { alternates: { canonical: "/search" } } : {}) };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const zip = first(sp.zip);
  const lat = first(sp.lat);
  const lng = first(sp.lng);
  const category = first(sp.category);
  const start: SearchStart = {
    place: zip && /^\d{5}$/.test(zip) ? { zip }
      : lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat, lng }
      : undefined,
    byName: first(sp.by) === "name",
    category: CATEGORIES.includes(category as Category) ? (category as Category) : undefined,
  };
  return (
    <main className="screen search-screen">
      <section className="wizard-panel" aria-label="Find a doctor">
        <SearchForm start={start} />
      </section>
    </main>
  );
}
