// Reads the home search bar: a ZIP code or street address, optionally with
// an insurance name typed alongside it ("33965 medicare"). Insurance words
// are only used to pre-answer the insurance question — never as a coverage
// answer.
import { KNOWN_INSURERS } from "./insurers";
import type { Category } from "./searchFlow";

export type QuickSearch = { location: string; category: Category | null; insurerName?: string };

const MARKETPLACE_WORDS = /\b(aca|marketplace|obamacare|healthcare\.gov|affordable care act)\b/i;
// "Medicare Advantage" is a private plan, so it must be checked before plain "medicare".
const OTHER_INSURERS = [...KNOWN_INSURERS].map((i) => i.name).sort((a, b) => b.length - a.length);

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function strip(text: string, pattern: RegExp): string {
  return text.replace(pattern, " ").replace(/\s*,\s*,/g, ",").replace(/\s+/g, " ").replace(/^[\s,]+|[\s,]+$/g, "");
}

export function parseQuickSearch(text: string): QuickSearch {
  const value = text.trim();
  for (const name of OTHER_INSURERS) {
    const pattern = new RegExp(`\\b${escape(name)}\\b`, "i");
    if (pattern.test(value)) return { location: strip(value, pattern), category: "other", insurerName: name };
  }
  if (/\bmedicare\b/i.test(value)) return { location: strip(value, /\b(original\s+)?medicare\b/i), category: "medicare" };
  if (MARKETPLACE_WORDS.test(value)) return { location: strip(value, MARKETPLACE_WORDS), category: "marketplace" };
  return { location: value, category: null };
}
