"use client";
import Link from "next/link";
import HomeSearchBar from "@/components/HomeSearchBar";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="screen error-screen">
      <h1>Something went wrong on our end.</h1>
      <p>Please try again. If it keeps happening, search again from the start.</p>
      <button type="button" className="btn-primary" onClick={reset}>Try again</button>
      <HomeSearchBar titleId="error-search-title" />
      <Link className="text-action-link" href="/">Go to the home page</Link>
    </main>
  );
}
