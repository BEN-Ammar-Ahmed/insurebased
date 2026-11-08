# Design system

A calm, plain healthcare utility for a mostly older audience. It should read
like a hospital or bank website, not a template. Full reasoning:
`docs/superpowers/specs/2026-11-07-redesign-design.md`.

## Color ("trustworthy blue")

All colors are tokens in `app/globals.css`. Components never use hex values.
The only exceptions are `app/global-error.tsx`, which renders without the
stylesheet, and the `themeColor` in `app/layout.tsx`.

| Token | Value | Use |
|---|---|---|
| `--primary` | `#1d4f91` | links, focus, buttons, search outline, logo |
| `--primary-press` | `#163d72` | button hover and press |
| `--ink` | `#14263d` | body text, headings |
| `--muted` | `#4d5d70` | secondary text |
| `--bg` | `#f5f8fc` | page background |
| `--surface` | `#ffffff` | cards, panels, header |
| `--line` | `#dde5ef` | borders, dividers |
| `--tint` | `#e9f0f9` | selected choice, light highlights |
| `--ok-bg` / `--ok-ink` | `#e3f2e8` / `#1d6b3e` | the "covered" badge only |
| `--danger` / `--danger-bg` | `#a12b38` / `#fbecee` | errors, "not covered" |

Green appears only on a real, source-backed "covered" result.

## Type

- **Font:** Inter only, weights 400 and 600.
- **Sizes:** body 18px with line-height 1.6. Page heading 28px on phones and 32px from 768px. Section headings 20–22px. Nothing larger.
- **Bold:** only provider names, headings and buttons.

## Controls and surfaces

- **Tap targets:** at least 48px.
- **Buttons:** solid `--primary` with white text and a 10px radius. The search pill and its Search button are fully rounded. Secondary buttons are white with a `--line` border.
- **Cards:** white, 1px `--line` border, 12px radius, no shadow. Only the open search panel has a shadow.
- **Focus:** always visible: a 3px `--primary` outline.

## Motion

The search panel opening is the only animation (`panel-open`, opacity plus
scale, 200ms). Hovers may change color in 150ms or less. Nothing pulses,
blinks, shimmers or loops, and loading placeholders are still. The
`prefers-reduced-motion` kill-switch must keep working.
`lib/designContract.test.ts` enforces this, along with the tokens and the
no-hex rule.

## Never

- Serif display headlines
- Slogans or kicker lines
- Feature grids
- Numbered "how it works" strips
- Fake stats, testimonials or stock photos
- Gradients, glass or glow
- Purple
- Emoji
- Floating notes over content
- Any count, filter or coverage answer not backed by real data

## Layout

- **Full width:** `.phone-shell` and the page container are full width up to 1200px, with 16–48px gutters.
- **Widths to check:** every change at 375, 768, 1024 and 1440px. No horizontal scroll, clipped text, or overlap.
- **Phone (under 768px):** the header links go into the Menu button, the search icon stays visible, and the results filters sit behind a Filters button.
- **1024px and up:** the results list and map show side by side.

Brand icons and PNGs are built from the SVGs in `public/brand` with
`npm run icons`.
