"use client";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Vercel Web Analytics (cookieless page views). Search URLs carry ZIP codes,
// coordinates, plan names and doctor names, so only the path is sent.
function pathOnly(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  return { ...event, url: url.origin + url.pathname };
}

// Off in development: the dev build loads a debug script from
// va.vercel-scripts.com, which our CSP (script-src 'self') blocks. In
// production it loads from this site's own /_vercel/insights path.
export default function SiteAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;
  return <Analytics beforeSend={pathOnly} />;
}
