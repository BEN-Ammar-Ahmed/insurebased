import Link from "next/link";
import Brand from "./Brand";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-intro"><Link className="site-brand" href="/"><Brand /></Link><p>Find doctors using trustworthy public provider and insurance data.</p><p>InsureBased is not an insurer, healthcare provider, or government service.</p></div>
        <nav aria-label="Explore"><h2>Explore</h2><Link href="/search">Find doctors</Link><Link href="/find">Browse by city</Link><Link href="/how-it-works">How it works</Link><Link href="/data">How our data works</Link></nav>
        <nav aria-label="About and support"><h2>About & support</h2><Link href="/about">About</Link><Link href="/report">Report incorrect info</Link><Link href="/accessibility">Accessibility</Link></nav>
        <nav aria-label="Legal"><h2>Legal</h2><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms of use</Link></nav>
        <div className="footer-disclosure"><p>Provider records: NPPES / NPI Registry. Original Medicare assignment: CMS Doctors and Clinicians. ACA plan checks: HealthCare.gov Marketplace data, when configured.</p><p>Independent project; not affiliated with or endorsed by CMS, HHS, or any insurer. Confirm the specific plan, office, service, and patient availability with the provider and insurer before a visit.</p><p>© {new Date().getFullYear()} InsureBased</p></div>
      </div>
    </footer>
  );
}
