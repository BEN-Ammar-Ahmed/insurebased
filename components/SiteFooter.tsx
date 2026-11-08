import Link from "next/link";

const links = [
  ["/find", "Browse by city"],
  ["/how-it-works", "How it works"],
  ["/data", "How our data works"],
  ["/about", "About"],
  ["/report", "Report incorrect info"],
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
  ["/accessibility", "Accessibility"],
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <nav aria-label="Footer">
          {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <p>Independent project. Provider records from the NPI Registry; Medicare data from CMS. Not affiliated with CMS, HHS, or any insurer.</p>
        <p>© {new Date().getFullYear()} InsureBased</p>
      </div>
    </footer>
  );
}
