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

0. **Home (landing)** — added 2026-07-18 at owner's request: the site must not open directly on the search form. Minimal single-column landing: hero headline, one-line description, primary CTA to `/search`, sample doctor card, three "How it works" steps (pick insurance → enter ZIP → call with confidence), second CTA, disclaimer footer.
1. **Search (`/search`)** — two tabs: "By insurance" (insurance category, ZIP input, optional specialty, exact Marketplace plan picker when configured) and "By doctor name" (name + optional state). Source-backed disclaimer in footer.
2. **Results** — List/Map toggle. List: doctor cards (avatar initials, name, specialty, distance, address, green "Accepts X" badge); nearby doctors who don't accept the plan appear dimmed below matches. Map: Leaflet map with pins for matches; tapping a pin shows a mini card. Search summary pill at top returns to search.
3. **Doctor profile** — name, specialty, NPI, address, tap-to-call phone button, full accepted-insurance chips (user's plan highlighted green, not-accepted shown in red section), small map of the office location.
4. Reverse lookup reuses Results and Profile screens.
5. **City directory (`/find`, `/find/[state]/[city]`, `/find/[state]/[city]/[specialty]`)** — added 2026-11-06 at owner's request so the site can be found through Google. Server-rendered pages for the 50 largest US cities × 12 specialties: breadcrumbs, heading, honest provider count, up to 50 provider cards with Original Medicare status streamed in, a "check your own insurance" CTA, and links to other specialties and cities. Provider profiles (`/doctor/[npi]`) are now server-rendered and indexable too, with Original Medicare status shown even when no insurance was chosen.

## Interactivity requirements

The site must feel app-like and alive, not like a static page:

- Skeleton loading cards while the API responds (never a blank screen or lone spinner).
- Animated transitions: list/map crossfade, card tap feedback (scale press), staggered card entrance (30–50ms).
- Debounced autosuggest on the doctor-name search.
- Instant client-side re-filtering when the specialty filter changes on results.
- Tap-to-call `tel:` links; tap address opens maps app.
- All animations 150–300ms, transform/opacity only, disabled under reduced motion.

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
