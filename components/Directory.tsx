// Server-rendered building blocks for the /find city directory pages.
import { Suspense } from "react";
import Link from "next/link";
import type { Doctor } from "@/lib/npi";
import { ChevronRightIcon } from "./Icons";
import DoctorCard from "./DoctorCard";
import { MedicareBadge, PendingCoverageBadge, type CoverageLookup } from "./MedicareStatus";

export type Crumb = { href?: string; label: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const site = process.env.SITE_URL;
  const jsonLd = site ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.label, ...(item.href ? { item: new URL(item.href, site).href } : {}) })),
  } : null;
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <ol>
        {items.map((item, i) => (
          <li key={item.label}>
            {item.href && i < items.length - 1 ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function DirectoryProviderCard({ doctor, lookup }: { doctor: Doctor; lookup: CoverageLookup }) {
  return (
    <DoctorCard doctor={doctor} query="" badge={
      <Suspense fallback={<PendingCoverageBadge />}>
        <MedicareBadge npi={doctor.npi} lookup={lookup} />
      </Suspense>
    } />
  );
}

export function LinkGrid({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  if (!links.length) return null;
  return (
    <section className="link-section" aria-label={title}>
      <h2 className="link-section-title">{title}</h2>
      <ul className="link-grid">
        {links.map(link => (
          <li key={link.href}><Link href={link.href}>{link.label}<ChevronRightIcon size={16} /></Link></li>
        ))}
      </ul>
    </section>
  );
}

export function DirectoryCta({ city }: { city?: string }) {
  return (
    <aside className="directory-cta">
      <div>
        <p className="directory-cta-title">Check your own insurance{city ? ` in ${city}` : ""}</p>
        <p className="directory-cta-body">Search near your ZIP code and check doctors against Medicare or your ACA Marketplace plan.</p>
      </div>
      <Link className="btn-primary" href="/">Search</Link>
    </aside>
  );
}
