// Server-rendered building blocks for the /find city directory pages.
import { Suspense } from "react";
import Link from "next/link";
import type { Doctor } from "@/lib/npi";
import { initialsOf } from "@/lib/options";
import { ChevronRightIcon, PhoneIcon } from "./Icons";
import { PrimaryDirectionsLink } from "./DirectionsLinks";
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
  const address = [doctor.address1, `${doctor.city}, ${doctor.state} ${doctor.zip}`].filter(Boolean).join(", ");
  return (
    <article className="card doctor-card">
      <div className="avatar" aria-hidden="true">{initialsOf(doctor.name)}</div>
      <div className="doctor-card-text">
        <h2 className="doctor-card-name"><Link href={`/doctor/${doctor.npi}`}>{doctor.name}</Link></h2>
        <p className="doctor-card-specialty">{doctor.specialty}</p>
        <p className="doctor-card-meta">{address}</p>
        <Suspense fallback={<PendingCoverageBadge />}>
          <MedicareBadge npi={doctor.npi} lookup={lookup} />
        </Suspense>
        <div className="doctor-actions">
          {doctor.phone && <a href={"tel:" + doctor.phone.replace(/[^\d+]/g, "")}><PhoneIcon size={15} />{doctor.phone}</a>}
          {doctor.address1 && <PrimaryDirectionsLink doctor={doctor} />}
          <Link href={`/doctor/${doctor.npi}`}>View profile</Link>
        </div>
      </div>
    </article>
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
        <p className="directory-cta-body">Search near your ZIP code and check providers against Medicare or your ACA Marketplace plan.</p>
      </div>
      <Link className="btn-primary" href="/search">Start a search</Link>
    </aside>
  );
}
