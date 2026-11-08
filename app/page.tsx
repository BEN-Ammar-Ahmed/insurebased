import type { Metadata } from "next";
import Link from "next/link";
import HomeSearchBar from "@/components/HomeSearchBar";

export const metadata: Metadata = { title: { absolute: "InsureBased — Find Doctors by Insurance and Location" }, ...(process.env.SITE_URL ? { alternates: { canonical: "/" } } : {}) };

export default function Home() {
  return (
    <main className="screen home-screen">
      {process.env.SITE_URL && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "InsureBased", url: process.env.SITE_URL, description: "Find nearby doctors and review available insurance coverage information using trustworthy public healthcare data.", publisher: { "@type": "Organization", name: "InsureBased", url: process.env.SITE_URL, logo: new URL("/brand/insurebased-logo.png", process.env.SITE_URL).href } }).replace(/</g, "\\u003c") }} />}
      <h1>Find a doctor who takes your insurance</h1>
      <HomeSearchBar />
      <Link className="text-action-link" href="/find">Browse doctors by city</Link>
    </main>
  );
}
