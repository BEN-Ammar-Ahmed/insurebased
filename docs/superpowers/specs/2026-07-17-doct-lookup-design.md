# Doct Lookup — Design Spec

**Date:** 2026-07-17
**Status:** Historical v1 direction; current app uses live public provider records and source-backed coverage only.

## What it is

A mobile-first website where a person picks their health insurance, enters a ZIP code, and sees real nearby doctors who accept that insurance. Built as a learning/portfolio project.

- Real providers, live from the free NPI Registry API (`https://npiregistry.cms.hhs.gov/api/`) — no API key required.
- Insurance coverage is never fabricated. Original Medicare labels use official CMS Provider Data; ACA Marketplace checks use the CMS Marketplace API when `CMS_MARKETPLACE_API_KEY` is configured; other insurance is labeled not verified.
- **Mobile-first is a hard requirement.** Every screen is designed for phones; desktop gets a centered column layout.

## Stack

- Next.js (App Router) with TypeScript.
- Leaflet + OpenStreetMap tiles for the map (free, no API key).
- No database — live APIs, in-memory caching, and address-level geocoding where a match is available.

## Design system (from ui-ux-pro-max: "Accessible & Ethical" healthcare style)

- Colors: primary `#0891B2` (cyan), CTA/accent `#059669` (health green), background `#ECFEFF`/white surfaces, foreground text `#164E63`, borders `#A5F3FC`/`#D9EEF4`, destructive `#DC2626`.
- Fonts: Figtree (headings), Noto Sans (body), 16px+ body text.
- Big touch targets (44px+), visible focus rings, WCAG AA contrast, `prefers-reduced-motion` respected.
- SVG icons (Lucide), never emoji. Sentence case everywhere.
- Anti-patterns to avoid: purple/pink AI gradients, cluttered nav, tiny text.

## Screens

Screens 0–3 were reworked on 2026-11-08 (owner-approved redesign, see
`docs/superpowers/specs/2026-11-07-redesign-design.md`).

0. **Home** — one plain heading, a big rounded search bar that opens in place into the search panel (ZIP code, street address, or current location, plus insurance as four choices; Search or "More options"), and a "Browse doctors by city" link. Every other page has a search icon in the top bar that opens the same panel.
1. **Question page (`/search`)** — one question per screen, each skippable, with "Skip all and show results": where (only if unknown), insurance (only if not chosen yet), exact ACA plan or insurer, kind of doctor (plain names), how far. `?by=name` asks for a doctor's name instead.
2. **Results** — heading, one summary line, Edit search (opens the panel), filters (kind of doctor, how far, only confirmed for my insurance; behind a Filters button on phones), light doctor cards with one coverage line, List/Map toggle on smaller screens, honest no-results, error and offline messages.
3. **Doctor profile** — plain heading, Original Medicare or plan check, office with Call and Directions, practice locations, official record links, office map.
4. Reverse lookup reuses Results and Profile screens.
5. **City directory (`/find`, `/find/[state]/[city]`, `/find/[state]/[city]/[specialty]`)** — added 2026-11-06 at owner's request so the site can be found through Google. Server-rendered pages for the 50 largest US cities × 12 specialties: breadcrumbs, heading, honest provider count, up to 50 provider cards with Original Medicare status streamed in, a "check your own insurance" CTA, and links to other specialties and cities. Provider profiles (`/doctor/[npi]`) are now server-rendered and indexable too, with Original Medicare status shown even when no insurance was chosen.

## Interactivity requirements

Since the 2026-11-08 redesign the site is calm rather than "alive": the only
animation is the search panel opening, and loading placeholders are still.

- Still placeholder cards while the API responds (never a blank screen or lone spinner).
- Debounced autosuggest on the doctor-name search.
- "How far" re-filters loaded results instantly; changing the kind of doctor runs a new search.
- Tap-to-call `tel:` links; tap address opens maps app.
- The panel animation is opacity/scale only, about 200ms, and disabled under reduced motion.

## Architecture

```
Browser (phone)
  └─ Next.js pages (App Router, client components for search/results/map)
       └─ /api/doctors/search   → calls NPI Registry (by ZIP+specialty or name)
       └─ /api/doctors/[npi]    → single doctor detail
            └─ lib/insuranceCheck.ts → Medicare / Marketplace / unsupported coverage dispatcher
            └─ lib/providerLocations.ts → address-level geocoding before pins/distances display
```

- The browser never calls the NPI registry directly; our API routes normalize the messy NPI response into a clean `Doctor` shape: `{ npi, name, specialty, address1, city, state, zip, phone, lat, lng, distanceMi }`.
- Coverage labels are computed per search from real data sources where available. Unknown and unavailable states stay honest instead of becoming guessed positives.
- Map pins: real provider practice addresses geocoded to latitude/longitude. If geocoding fails, do not show a fabricated pin for that provider.
- Insurer list: common carrier names are used for the unsupported "Other / employer insurance" directory helper only; they do not drive coverage answers.

## Error handling

- Invalid ZIP caught client-side before searching (5 digits, exists in ZIP table).
- NPI API error/timeout → friendly message + retry button.
- Zero results → "try a wider search" with one-tap actions (clear specialty filter).
- All error states designed, not left as blank screens.

## Testing

- Unit tests: NPI response normalization, Medicare/Marketplace coverage handling, provider address geocoding, search params, security boundaries, and ZIP validation.
- Manual verification in phone-sized browser preview (375px) after each feature.

## Out of scope (v1)

- Accounts/login, reviews, appointment booking, non-US providers, and unsupported commercial/employer network verification.
