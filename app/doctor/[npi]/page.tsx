import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isValidNpi } from "@/lib/validation";
import { getProvider } from "@/lib/provider";
import { computeCoverage } from "@/lib/insuranceCheck";
import { cityForAddress, cityPath } from "@/lib/cities";
import { SPECIALTY_LIST } from "@/lib/specialties";
import type { Doctor } from "@/lib/npi";
import DoctorProfile from "@/components/DoctorProfile";
import { MedicareDetails, PendingCoverageBadge } from "@/components/MedicareStatus";

type PageProps = {
  params: Promise<{ npi: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

function place(doctor: Doctor) {
  return [doctor.city, doctor.state].filter(Boolean).join(", ");
}

function moreLinkFor(doctor: Doctor) {
  const city = cityForAddress(doctor.city, doctor.state);
  if (!city) return null;
  const specialty = SPECIALTY_LIST.find(s => s.primary.test(doctor.specialty));
  return specialty
    ? { href: cityPath(city, specialty.slug), label: `More ${specialty.plural.toLowerCase()} in ${city.name}` }
    : { href: cityPath(city), label: `More providers in ${city.name}` };
}

async function loadProvider(npi: string): Promise<Doctor | null | undefined> {
  try { return await getProvider(npi); } catch { return undefined; }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { npi } = await params;
  if (!isValidNpi(npi)) return {};
  const doctor = await loadProvider(npi);
  if (!doctor) return { title: "Provider profile", robots: { index: false } };
  const title = `${doctor.name} – ${doctor.specialty} in ${place(doctor)}`;
  const description = `${doctor.name}, ${doctor.specialty.toLowerCase()} in ${place(doctor)}. Office address${doctor.phone ? ", phone number" : ""}, directions, and Original Medicare assignment status from official CMS data. NPI ${doctor.npi}.`;
  return {
    title,
    description,
    ...(process.env.SITE_URL ? { alternates: { canonical: `/doctor/${npi}` } } : {}),
    openGraph: { type: "profile", title, description },
  };
}

function structuredData(doctor: Doctor) {
  const type = /,\s*(MD|DO)\b/i.test(doctor.name) ? "Physician" : /,\s*(DDS|DMD)\b/i.test(doctor.name) ? "Dentist" : null;
  if (!type) return null;
  return {
    "@context": "https://schema.org",
    "@type": type,
    name: doctor.name,
    ...(process.env.SITE_URL ? { url: new URL(`/doctor/${doctor.npi}`, process.env.SITE_URL).href } : {}),
    ...(doctor.phone ? { telephone: doctor.phone } : {}),
    identifier: { "@type": "PropertyValue", propertyID: "NPI", value: doctor.npi },
    address: { "@type": "PostalAddress", streetAddress: doctor.address1, addressLocality: doctor.city, addressRegion: doctor.state, postalCode: doctor.zip, addressCountry: "US" },
    ...(doctor.lat !== null && doctor.lng !== null ? { geo: { "@type": "GeoCoordinates", latitude: doctor.lat, longitude: doctor.lng } } : {}),
  };
}

export default async function DoctorPage({ params, searchParams }: PageProps) {
  const { npi } = await params;
  if (!isValidNpi(npi)) notFound();
  const sp = await searchParams;
  const category = sp.category ?? "none";
  // undefined = registry unreachable: the client component shows a retry.
  const doctor = await loadProvider(npi);
  if (doctor === null) notFound();

  // Original Medicare status is public, so it's shown even without an
  // insurance choice. It streams in after the rest of the page.
  const showMedicare = doctor && (category === "none" || category === "medicare");
  const lookup = showMedicare ? computeCoverage([npi], { category: "medicare" }) : null;
  const jsonLd = doctor ? structuredData(doctor) : null;

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <DoctorProfile
        npi={npi}
        category={category}
        planId={sp.planId ?? ""}
        planName={sp.planName ?? ""}
        issuerName={sp.issuerName ?? ""}
        planYear={sp.planYear ?? ""}
        insurerName={sp.insurerName ?? ""}
        initialDoctor={doctor ?? null}
        moreLink={doctor ? moreLinkFor(doctor) : null}
        medicareSlot={lookup ? (
          <Suspense fallback={<PendingCoverageBadge text="Checking official Medicare records…" />}>
            <MedicareDetails npi={npi} lookup={lookup} />
          </Suspense>
        ) : undefined}
      />
    </>
  );
}
