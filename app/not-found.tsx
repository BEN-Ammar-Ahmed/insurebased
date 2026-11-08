import type { Metadata } from "next";
import Link from "next/link";
import HomeSearchBar from "@/components/HomeSearchBar";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="screen error-screen">
      <h1>We can&apos;t find that page.</h1>
      <p>The link may be old, or the address may have a typo. You can search for a doctor below.</p>
      <HomeSearchBar titleId="not-found-search-title" />
      <Link className="text-action-link" href="/">Go to the home page</Link>
    </main>
  );
}
