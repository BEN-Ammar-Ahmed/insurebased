import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Pragmatic, not nonce-based: the app renders many inline `style` props and
// Next.js embeds small inline bootstrap scripts, so script-src/style-src
// need 'unsafe-inline' rather than a stricter nonce scheme (that would need
// per-request middleware). connect-src is 'self' only because the browser
// never calls anything but our own API routes — every external API call
// (NPI registry, CMS, geocoding) happens server-side.
//
// 'unsafe-eval' is added ONLY in development: Next's dev server compiles
// with an eval-based devtool for hot reload, and without 'unsafe-eval' the
// CSP silently blocks every module from executing — the page renders its
// initial HTML but React never hydrates (verified by testing: removing the
// header fixed hydration immediately). Production builds don't use eval,
// so this stays out of the deployed CSP.
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://tile.openstreetmap.org",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  // lib/medicareList.ts reads this file at runtime with fs, which Next's
  // file tracing can't see on its own; include it in every server function.
  outputFileTracingIncludes: { "/**": ["./data/medicare/assignment.bin"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
