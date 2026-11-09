# InsureBased redesign — design

Date: 2026-11-07. Owner-approved in conversation; this document is the written form.

## Why

The owner feels the site "looks fake" and AI-generated: big decorative
headlines, marketing sections, bold text everywhere, pulsing/blinking loaders
and floating elements. The audience is everyone, but **mostly older adults**
picking a doctor. They need a calm, plain, trustworthy utility: big readable
text, obvious controls, nothing to decode. The site's data work (real NPI
providers, real Medicare data, honest labels) stays exactly as it is; this is
a redesign of how it looks and how search is entered.

Success: an older visitor lands, sees one search bar, finds a nearby doctor
who takes their insurance, and calls them — and the site reads like a real
hospital or bank website, not a template.

## Goals

1. **New visual system — "trustworthy blue"** (owner picked this).
   Navy and clear blue on white/very pale blue. Green appears only on a real
   "covered" coverage result (unchanged rule).
2. **A single search bar that opens when tapped** (owner's idea, option C):
   a big rounded search bar on the home page; a search icon in the top bar on
   every other page that opens the same search.
3. **Optional question page for more detail**, every question skippable.
4. **The same filters on the results page**, so nobody has to answer
   questions up front.
5. **Remove everything that reads as AI-made** (list under Anti-goals).
6. **Real error pages**: 404, 500, offline, and no-results, in the new style.
7. Everything still works at 375, 768, 1024 and 1440 px.

## Non-goals

- No change to data sources, coverage logic, caching, or the SEO pages'
  server rendering and metadata (`/find`, `/doctor/[npi]`).
- No new insurance types (Medicare Advantage is a separate future project).
- No true radius search across several ZIP codes (see "How far" below).
- No offline mode / service worker — only a clear offline message.
- No accounts, saved searches, ratings, or "accepting new patients" — there
  is no reliable real data for those.

## Anti-goals (would make this a failure even if it works)

- Big decorative serif headlines, slogans, kicker lines, "trust" blurbs,
  feature grids, numbered "how it works" step strips, fake stats,
  testimonials, stock photos.
- Bold text used for emphasis everywhere. Only provider names, the page
  heading, and buttons are bold.
- Anything that pulses, blinks, shimmers, or floats over content without
  being asked for. Gradients, glass/glow effects, purple, emoji.
- Hiding the search behind an icon on the home page (older visitors may miss
  it — this is why the owner chose a visible bar on home, icon elsewhere).
- Showing any coverage answer, filter, or count that isn't backed by real
  data.

## Visual system

All values live as tokens in `app/globals.css` (no hex in components).
Replace the current bottle-green/brass/ivory tokens:

| Token | Value | Use |
|---|---|---|
| `--primary` | `#1d4f91` | links, focus, buttons, search outline, logo |
| `--primary-press` | `#163d72` | button hover/press |
| `--ink` | `#14263d` | body text, headings |
| `--muted` | `#4d5d70` | secondary text (must keep ≥ 4.5:1 on white) |
| `--bg` | `#f5f8fc` | page background |
| `--surface` | `#ffffff` | cards, panels, header |
| `--line` | `#dde5ef` | borders, dividers |
| `--tint` | `#e9f0f9` | selected choice, light highlights |
| `--ok-bg` / `--ok-ink` | `#e3f2e8` / `#1d6b3e` | "covered" badge only |
| `--danger` / `--danger-bg` | `#a12b38` / `#fbecee` | errors, "not covered" |

- **Type:** one sans-serif family (Inter, already bundled) for everything;
  drop the Fraunces display font. Weights 400 and 600 only.
  Body **18px** (older readers), line-height 1.6. Page heading 28px on
  phones, 32px on desktop. Section headings 20–22px. Nothing larger.
- **Controls:** minimum 48px tall/wide tap targets. Buttons: solid
  `--primary`, white text, rounded (pill for the search button; 10px radius
  elsewhere). Secondary buttons: white with `--line` border.
- **Cards:** white, 1px `--line` border, 12px radius, no shadows except the
  open search panel (one soft shadow so it reads as "opened").
- **Motion:** only the search bar opening (opacity + scale, ~200ms,
  ease-out) and small hover color changes. Loading placeholders are **still**
  (no pulse/shimmer). The existing `prefers-reduced-motion` kill-switch must
  keep working.
- **Remove the Next.js dev indicator** (the dark floating "N" circle seen in
  development): `devIndicators: false` in `next.config.ts`.

## Header and footer

- **Header (every page):** logo on the left; links "Browse by city" and
  "About"; on every page **except home**, a round search icon button on the
  right that opens the search panel (below). On phones the links collapse
  into the existing Menu button; the search icon stays visible next to it.
- Remove the dark "Find a doctor" CTA button from the header.
- **Footer:** one short row/stack of plain links (Browse by city, How it
  works, How our data works, About, Report incorrect info, Privacy, Terms,
  Accessibility) and the one-line independence/source disclosure. No logo
  block, no columns of marketing text.

## Search

### The bar (home page)

A single wide rounded bar (like the owner's reference screenshot): magnifier
icon + placeholder "Search by ZIP code, address, or insurance…". Full width
on phones, ~640px max on desktop. Nothing else competes with it.

### Opening it

Tapping/clicking or focusing the bar opens the **search panel** in place
(animated as above). Panel contents, top to bottom:

1. **"Where are you looking?"** — one text field accepting a 5-digit ZIP
   code **or** a street address, plus a **"Use my current location"** button
   (browser GPS permission prompt). Errors are plain and specific ("We
   couldn't find that address. Try a ZIP code.").
2. **"Your insurance"** — four large tappable choices (radio-group
   semantics): Medicare (Original Medicare), ACA Marketplace (HealthCare.gov
   plans), Employer or other (Aetna, Blue Cross, …), Skip for now (show all
   doctors). Default: none selected = treated as Skip.
3. **Search** button and a **"More options ›"** link.
4. A way to close it (Close button, Escape key, and clicking outside on
   desktop). Focus moves into the panel on open and back to the bar on close.

**Search** goes straight to results. **More options** goes to the question
page carrying what was already entered. If ACA Marketplace was chosen,
Search also goes to the question page first, because ACA checks need an
exact plan (it can be skipped there; the results then say coverage wasn't
checked for a specific plan).

### On other pages

The header search icon opens the **same panel** (same component) as a panel
dropping down under the header; on phones it fills the screen width. Closing
returns focus to the icon.

### Address input

A street address is resolved server-side with the existing Census geocoder
(`addressToLatLng` in `lib/geo.ts`) into coordinates, then searched the same
way as GPS (`lat`/`lng` area mode). If it doesn't resolve, say so and ask
for a ZIP — never guess a location.

### Question page (`/search`)

Rework the existing step-by-step wizard into the new style. One question per
screen, each with **Skip** and a **"Skip all and show results"** link,
progress "Question 1 of N", and Back. Questions, only when relevant:

1. Insurance details — only for ACA Marketplace (plan year + exact plan,
   needs location; existing plan picker) and Employer or other (optional
   insurer name, existing behavior). Medicare and Skip get no question here.
2. "What kind of doctor do you need?" — the 12 specialties from
   `lib/specialties.ts` as large choices, using plain names where helpful
   (e.g. "Heart doctor (cardiologist)") — wording is the builder's call.
3. "How far are you willing to travel?" — Any / 1 / 3 / 5 / 10 miles.

If the visitor arrives with no location (e.g. typed `/search` directly), the
first screen asks where they're looking (same field + GPS button). Search by
provider name stays available from this page as a secondary link
("Search by a doctor's name instead"), as today.

## Results page

- Top: a short plain heading ("Doctors near 60614"), one line summarising
  insurance/specialty, and an "Edit search" button that opens the search
  panel prefilled.
- **Filters row** (same as the question page, always available, never
  required): Kind of doctor, How far, "Only doctors confirmed for my
  insurance" (shown only for Medicare/ACA). On phones the filters sit in a
  single "Filters" button that opens a simple sheet/panel.
- **"How far"** filters the providers already loaded by their real computed
  distance; providers with no mapped location are hidden only when a
  distance filter is active, and the count says so. (True wider-radius search
  is a non-goal.) — *builder's call, see below.*
- **Cards** (lighter): name (bold), specialty, distance, address, one
  coverage line (the badge), and Call / Directions / View profile. Remove the
  per-card source/date captions and repeated notes; keep one disclaimer line
  at the bottom of the page. Coverage still loads after the list renders
  (CLAUDE.md rule) — while loading, show static text "Checking Medicare…",
  no pulsing dot.
- **Map:** keep pins, grouping, and the pin card; remove the floating
  "N providers could not be placed" overlay note (move that sentence under
  the map, only when it applies). List/Map toggle on phones stays.

## Provider profile and city directory pages

Restyle only: plain heading (no serif, no oversized title), Office card with
Call (primary) and Directions (secondary), coverage card, map, record links.
Keep all SEO metadata, JSON-LD, streaming Medicare, and links. City pages:
plain breadcrumb, heading, one-sentence intro, the provider list using the
same lighter card, and link lists.

## Info pages

About, How it works, How our data works, Privacy, Terms, Accessibility,
Report: same content, restyled as a plain readable article (max ~70
characters per line, normal headings). Remove the decorative label above the
Accessibility heading.

## Error pages

All in the new style, each with a short plain message, **the search bar**,
and a link home:

| Page | File | Message (builder may polish wording) |
|---|---|---|
| 404 — Page not found | `app/not-found.tsx` | "We can't find that page." Search bar + Home link |
| 500 — Something went wrong | `app/error.tsx` | "Something went wrong on our end." Try again button + search bar + Home |
| 500 (whole site down) | `app/global-error.tsx` | Must render without the normal layout; minimal page in the same colors with Try again + Home link |
| Offline | results/profile fetch failures when `navigator.onLine` is false | "You're offline. Check your internet connection and try again." + Try again |
| No results | results empty state | "No doctors found here." Suggest a nearby ZIP, removing a filter, or skipping insurance; buttons for each |

Existing error codes in `ResultsClient` (rate limited, invalid ZIP, area
unresolved) keep their specific messages, restyled the same way.

## Home page content

Header, one short line of text above the bar (e.g. "Find a doctor who takes
your insurance" — normal heading size), the search bar, and a small "Browse
doctors by city" link (plus the existing short city link list is allowed only
if it stays visually quiet — builder's call). Delete the other home sections
and the unused parts of `lib/homeContent.ts`. Keep the WebSite JSON-LD.

## Constraints

- Follow CLAUDE.md conventions (tokens in `globals.css`, no hex in
  components, green only for "covered", inline Lucide icons in
  `components/Icons.tsx`, sentence case, `CoverageDisplay` for every
  coverage result, never fabricate coordinates or coverage).
- Accessibility: WCAG 2.2 AA contrast, visible focus, labeled fields, the
  panel usable by keyboard and screen reader (dialog/disclosure semantics),
  48px targets.
- Keep URLs and query params working (`/results?zip=…&category=…`,
  `/search?zip=`, `?by=name`, `/doctor/[npi]?category=…`) so shared links
  and Google results don't break.
- Update `docs/DESIGN_SYSTEM.md`, the visual-direction lines in `CLAUDE.md`,
  and the screen list in `docs/superpowers/specs/2026-07-17-doct-lookup-design.md`.
- Update unit and e2e tests for changed text/flows; production build must
  pass (`npm run build && npx next start` check for `/find` pages).

## Decided by the owner

- Trustworthy blue palette (option A).
- Search: big visible bar on home, icon on all other pages (option C), bar
  opens on tap with an animation.
- Inside: location (ZIP, address, or GPS) and insurance as choices.
- "More options" leads to a one-question-per-screen page (option B), every
  question skippable, with the same filters on the results page.
- Remove AI-looking patterns: big headers, bold everywhere, blinking,
  floating things, clutter.
- Error pages: 404, 500, offline, no results.
- 2026-11-08 change: the home search starts as just a round search icon. On
  hover (or keyboard focus) it grows into the search bar; click or tap opens
  the search panel. Phones have no hover, so a tap opens the panel directly.

## Calls made by Claude (owner can override)

- Body text 18px and 48px tap targets, for the older audience.
- Single sans-serif font; serif display font removed.
- Header links reduced to Browse by city + About; the rest move to the footer.
- ACA Marketplace always routes through the plan question (it can be skipped).
- "How far" filters loaded results by real distance only; no wider radius
  search in this project.
- Distance choices: Any / 1 / 3 / 5 / 10 miles.
- Coverage-loading text is static ("Checking Medicare…"), no animation.
- The search panel has a small "Search by a doctor's name instead" link
  (opens the name step of the question page), so name search stays one tap
  away without a second box on the home page.
- If ACA Marketplace checks aren't configured (`CMS_MARKETPLACE_API_KEY`
  missing), the ACA choice stays visible; the plan question says plainly that
  plan checks aren't available yet and lets the visitor continue without one.
- `app/global-error.tsx` replaces the whole layout and can't rely on the
  site stylesheet, so it may use a few inline color values matching the
  tokens — the one allowed exception to "no hex in components".

## Left to the builder

Exact spacing, shadow and radius tuning; icon choices; final copy wording;
whether the phone filters open as a sheet or an inline panel; how the panel
animates its height; component structure and naming; test details.
