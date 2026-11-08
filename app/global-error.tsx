"use client";

// Shown only when the whole layout fails, so it can't use the site
// stylesheet. The colors below copy the tokens in app/globals.css.
const ink = "#14263d";
const bg = "#f5f8fc";
const primary = "#1d4f91";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: bg, color: ink, fontFamily: "system-ui, sans-serif", fontSize: 18, lineHeight: 1.6 }}>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 16px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
          <p style={{ margin: 0, fontWeight: 600, color: primary }}>InsureBased</p>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, lineHeight: 1.25 }}>Something went wrong on our end.</h1>
          <p style={{ margin: 0 }}>Please try again in a moment.</p>
          <button type="button" onClick={reset} style={{ minHeight: 48, padding: "12px 24px", border: 0, borderRadius: 10, background: primary, color: "#ffffff", font: "inherit", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
          {/* A plain link: client navigation may be what failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ color: primary, minHeight: 48, display: "inline-flex", alignItems: "center" }}>Go to the home page</a>
        </main>
      </body>
    </html>
  );
}
