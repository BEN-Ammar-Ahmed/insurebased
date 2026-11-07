import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "InsureBased — Find Doctors by Insurance and Location" }, ...(process.env.SITE_URL ? { alternates: { canonical: "/" } } : {}) };
import Link from "next/link";
import HomeSearch from "@/components/HomeSearch";
import { CITIES, cityPath } from "@/lib/cities";
import { HOME_COPY } from "@/lib/homeContent";
import {
  CheckIcon,
  MapPinIcon,
  PhoneIcon,
  SearchIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
} from "@/components/Icons";

const TRUST_ICONS = {
  shield: ShieldCheckIcon,
  check: CheckIcon,
} as const;

const STEP_ICONS = {
  pin: MapPinIcon,
  stethoscope: StethoscopeIcon,
  phone: PhoneIcon,
} as const;

export default function Home() {
  return (
    <>
      <main className="screen home-screen">
        {process.env.SITE_URL && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "InsureBased", url: process.env.SITE_URL, description: "Find nearby doctors and review available insurance coverage information using trustworthy public healthcare data.", publisher: { "@type": "Organization", name: "InsureBased", url: process.env.SITE_URL, logo: new URL("/brand/insurebased-logo.png", process.env.SITE_URL).href } }).replace(/</g, "\\u003c") }} />}

        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <p className="home-kicker">InsureBased · {HOME_COPY.kicker}</p>
            <h1 id="home-title">{HOME_COPY.title}</h1>
            <p className="home-hero-subtitle">{HOME_COPY.subtitle}</p>
            <p className="home-hero-note">
              <ShieldCheckIcon size={16} />
              Real provider records. Honest coverage labels.
            </p>
          </div>
        </section>

        <HomeSearch />

        <section className="home-about-card" aria-labelledby="home-about-title">
          <div className="home-about-copy">
            <p className="home-section-label">{HOME_COPY.what.label}</p>
            <h2 id="home-about-title">{HOME_COPY.what.title}</h2>
            <p>{HOME_COPY.what.body}</p>
          </div>
          <dl className="home-fact-list">
            {HOME_COPY.what.facts.map((fact) => (
              <div key={fact.value}>
                <dt>{fact.value}</dt>
                <dd>{fact.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="home-trust-grid" aria-label="Data clarity">
          {HOME_COPY.trustItems.map((item) => {
            const Icon = TRUST_ICONS[item.icon];
            return (
              <article key={item.title} className="home-trust-item">
                <span className="home-trust-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.body}</p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="home-flow" aria-labelledby="home-flow-title">
          <h2 id="home-flow-title">How the search works</h2>
          <p className="home-flow-intro">
            A short path from location to a provider you can call.
          </p>
          <ol>
            {HOME_COPY.steps.map((step) => {
              const Icon = STEP_ICONS[step.icon];
              return (
                <li key={step.title}>
                  <span className="home-flow-icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <div>
                    <p>{step.title}</p>
                    <span>{step.body}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="link-section home-cities" aria-labelledby="home-cities-title">
          <h2 id="home-cities-title" className="link-section-title">Browse doctors by city</h2>
          <ul className="link-grid">
            {CITIES.slice(0, 11).map(city => (
              <li key={city.slug}><Link href={cityPath(city)}>{city.name}, {city.state}</Link></li>
            ))}
            <li><Link href="/find">All 50 cities</Link></li>
          </ul>
        </section>

        <section className="home-search-footer" aria-label="Detailed insurance search">
          <SearchIcon size={17} />
          <p>
            Already know your plan? The detailed search lets you choose ACA Marketplace,
            Original Medicare, or another insurer before viewing results.
          </p>
        </section>
      </main>
    </>
  );
}
